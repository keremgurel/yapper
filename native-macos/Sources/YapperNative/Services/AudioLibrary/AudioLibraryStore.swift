import Foundation

/// The creator's own audio, kept between projects.
///
/// One store for the whole app: the library page and the editor's sound shelf
/// are two views of the same folder, and a sound imported in one has to be on
/// the other's shelf immediately.
///
/// Everything is local. A saved sound is a copy in Application Support, which
/// makes importing instant and free and means the library does not follow the
/// account to another Mac. That is the trade taken deliberately: waiting on an
/// upload to hear a whoosh is worse than the library being per-machine.
@MainActor
final class AudioLibraryStore: ObservableObject {
    static let shared = AudioLibraryStore()

    @Published private(set) var items: [SavedAudio] = []
    /// Saved sounds whose file is no longer on disk, deleted from Finder or
    /// lost with a restored machine. Shown as missing rather than quietly
    /// dropped, because the creator is the only one who knows whether the file
    /// is coming back.
    @Published private(set) var missingIDs: Set<UUID> = []
    /// The file being imported right now, so a 40MB bed can say so.
    @Published private(set) var importingName: String?
    @Published private(set) var isRecovering = false
    @Published var errorMessage: String?

    private let importer: any AudioLibraryImporting
    private let manifest: any AudioLibraryManifestPersisting
    private let candidateStore: any AudioLibraryCandidatePersisting
    private let files: AudioLibraryFileOperations
    private var mutationInProgress = false
    private var manifestIsReadable = true
    private var recoveryTask: Task<RecoveryResult, Never>?

    init(
        importer: any AudioLibraryImporting = AudioLibraryImporter.shared,
        manifest: any AudioLibraryManifestPersisting = AudioLibraryManifestStore(),
        candidateStore: any AudioLibraryCandidatePersisting = AudioLibraryCandidateStore(),
        files: AudioLibraryFileOperations = .live
    ) {
        self.importer = importer
        self.manifest = manifest
        self.candidateStore = candidateStore
        self.files = files
        load()
    }

    /// Everything of one kind, newest first: the sound just imported is the one
    /// being looked for.
    func items(of kind: SavedAudioKind) -> [SavedAudio] {
        items.filter { $0.kind == kind }.sorted { $0.addedAt > $1.addedAt }
    }

    func url(for item: SavedAudio) -> URL {
        AudioLibraryFolder.url(for: item)
    }

    func ownsAvailable(_ item: SavedAudio) -> Bool {
        items.contains(where: { $0.id == item.id }) && files.isRegularFile(url(for: item))
    }

    /// Copies files into the library, skipping any already saved.
    /// - Returns: what was added, for a page that wants to select it.
    @discardableResult
    func add(_ urls: [URL]) async throws -> [SavedAudio] {
        await finishRecovery()
        try beginMutation()
        defer {
            importingName = nil
            mutationInProgress = false
        }
        guard manifestIsReadable else {
            let message = "Your audio library index is unreadable. Repair or restore it before importing."
            errorMessage = message
            throw UnreadableIndex(message: message)
        }
        var added: [SavedAudio] = []
        for url in urls {
            try Task.checkCancellation()
            importingName = url.lastPathComponent
            do {
                let taken = Set(items.map(\.fileName.localizedLowercase))
                let hashes = Set(items.map(\.contentHash))
                if let staged = try await importer.stageFile(
                    at: url,
                    taken: taken,
                    existingHashes: hashes
                ) {
                    do {
                        try Task.checkCancellation()
                    } catch {
                        discard(staged)
                        throw error
                    }
                    try commit(staged)
                    added.append(staged.item)
                }
            } catch is CancellationError {
                throw CancellationError()
            } catch let failure as AudioLibraryImporter.Failure {
                errorMessage = failure.reason
            } catch {
                errorMessage = "Your audio library could not be saved: \(error.localizedDescription)"
                break
            }
        }
        return added
    }

    func rename(_ id: UUID, to name: String) async {
        await finishRecovery()
        guard beginMutationReportingFailure() else { return }
        defer { mutationInProgress = false }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let index = items.firstIndex(where: { $0.id == id }) else { return }
        guard items[index].name != trimmed else { return }
        var candidate = items
        candidate[index].name = trimmed
        persistAndPublish(candidate)
    }

    func setKind(_ kind: SavedAudioKind, for id: UUID) async {
        await finishRecovery()
        guard beginMutationReportingFailure() else { return }
        defer { mutationInProgress = false }
        guard let index = items.firstIndex(where: { $0.id == id }), items[index].kind != kind else {
            return
        }
        var candidate = items
        candidate[index].kind = kind
        persistAndPublish(candidate)
    }

    /// Removes the entry and the copy it owns. The file the creator imported
    /// from is never touched.
    @discardableResult
    func remove(
        _ id: UUID,
        isReferenced: @MainActor () -> Bool = { false }
    ) async -> Bool {
        await finishRecovery()
        guard beginMutationReportingFailure() else { return false }
        defer { mutationInProgress = false }
        guard manifestIsReadable else {
            errorMessage = "Your audio library index is unreadable. Nothing was deleted."
            return false
        }
        guard !isReferenced() else {
            errorMessage = "This sound is used by the open project or its undo history. Remove it from the timeline and history before deleting it from the library."
            return false
        }
        guard let index = items.firstIndex(where: { $0.id == id }) else { return false }
        let item = items[index]
        let source = AudioLibraryFolder.url(for: item)
        let tombstone = AudioLibraryFolder.tombstoneURL(for: item)
        AudioLibraryFolder.ensureTransactionDirectories()
        var movedToTrash = false
        do {
            if files.exists(source) {
                if files.exists(tombstone) {
                    try files.remove(tombstone)
                }
                try files.move(source, tombstone)
                movedToTrash = true
            }
            var candidate = items
            candidate.remove(at: index)
            try manifest.save(AudioLibraryIndex(items: candidate))
            items = candidate
            missingIDs.remove(id)
            if movedToTrash { try? files.remove(tombstone) }
            return true
        } catch {
            if movedToTrash, !files.exists(source) {
                try? files.move(tombstone, source)
            }
            if !files.exists(source) { missingIDs.insert(id) }
            errorMessage = "Your audio library could not be changed: \(error.localizedDescription)"
            return false
        }
    }

    private func load() {
        do {
            let index = try manifest.load() ?? AudioLibraryIndex()
            try AudioLibraryValidation.validate(index)
            items = index.items
            let fileOperations = files
            let candidateStore = candidateStore
            isRecovering = true
            recoveryTask = Task.detached(priority: .utility) {
                Self.reconcileTransactions(
                    index: index,
                    files: fileOperations,
                    candidateStore: candidateStore
                )
            }
            Task { [weak self] in await self?.finishRecovery() }
        } catch {
            // A library nobody can read is worse left in place than reported:
            // the next import would write over it.
            manifestIsReadable = false
            errorMessage = "Your audio library could not be read. Nothing was changed."
        }
    }

    private func finishRecovery() async {
        guard let recoveryTask else { return }
        let result = await recoveryTask.value
        if result.candidateUnreadable {
            manifestIsReadable = false
            errorMessage = "An unfinished audio import could not be recovered. Nothing was changed."
        } else if let recovered = result.recoveredCandidate,
                  !items.contains(where: { $0.id == recovered.item.id }) {
            do {
                let recoveredItems = items + [recovered.item]
                try manifest.save(AudioLibraryIndex(items: recoveredItems))
                items = recoveredItems
                try candidateStore.clear()
            } catch {
                manifestIsReadable = false
                errorMessage = "An unfinished audio import could not be recovered. Nothing was changed."
            }
        } else if result.clearCandidate {
            try? candidateStore.clear()
        }
        missingIDs = Set(items.filter { !files.exists(url(for: $0)) }.map(\.id))
        self.recoveryTask = nil
        isRecovering = false
    }

    func waitForRecovery() async { await finishRecovery() }

    private struct MutationInProgress: LocalizedError {
        var errorDescription: String? {
            "Finish the current audio library change before starting another."
        }
    }

    private struct UnreadableIndex: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    private func beginMutation() throws {
        guard !mutationInProgress else { throw MutationInProgress() }
        mutationInProgress = true
    }

    private func beginMutationReportingFailure() -> Bool {
        do {
            try beginMutation()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func commit(_ staged: StagedAudioImport) throws {
        let destination = AudioLibraryFolder.url(for: staged.item)
        defer {
            if files.exists(staged.stagedURL) {
                try? files.remove(staged.stagedURL)
            }
        }
        let importCandidate = AudioLibraryImportCandidate(
            item: staged.item,
            stagedFileName: staged.stagedURL.lastPathComponent
        )
        try candidateStore.save(importCandidate)
        try files.move(staged.stagedURL, destination)
        do {
            let candidate = items + [staged.item]
            try manifest.save(AudioLibraryIndex(items: candidate))
            items = candidate
            missingIDs.remove(staged.item.id)
            try? candidateStore.clear()
        } catch {
            try? files.remove(destination)
            if !files.exists(destination) { try? candidateStore.clear() }
            throw error
        }
    }

    private func discard(_ staged: StagedAudioImport) {
        if files.exists(staged.stagedURL) { try? files.remove(staged.stagedURL) }
    }

    private func persistAndPublish(_ candidate: [SavedAudio]) {
        guard manifestIsReadable else {
            errorMessage = "Your audio library index is unreadable. Nothing was changed."
            return
        }
        do {
            try manifest.save(AudioLibraryIndex(items: candidate))
            items = candidate
        } catch {
            errorMessage = "Your audio library could not be saved: \(error.localizedDescription)"
        }
    }

    private struct RecoveryResult: Sendable {
        var recoveredCandidate: AudioLibraryImportCandidate?
        var clearCandidate = false
        var candidateUnreadable = false
    }

    nonisolated private static func reconcileTransactions(
        index: AudioLibraryIndex,
        files: AudioLibraryFileOperations,
        candidateStore: any AudioLibraryCandidatePersisting
    ) -> RecoveryResult {
        let importCandidate: AudioLibraryImportCandidate?
        do {
            importCandidate = try candidateStore.load()
            if let importCandidate { try AudioLibraryValidation.validate(importCandidate) }
        } catch {
            return RecoveryResult(candidateUnreadable: true)
        }
        AudioLibraryFolder.ensureTransactionDirectories()
        var recoveredCandidate: AudioLibraryImportCandidate?
        var clearCandidate = false
        if let importCandidate {
            if index.items.contains(where: { $0.id == importCandidate.item.id }) {
                clearCandidate = true
            } else {
                let staged = AudioLibraryFolder.stagingDirectory
                    .appending(path: importCandidate.stagedFileName)
                let final = AudioLibraryFolder.url(for: importCandidate.item)
                if !files.exists(final), files.exists(staged) {
                    try? files.move(staged, final)
                }
                if files.exists(final) {
                    recoveredCandidate = importCandidate
                } else if files.exists(staged) {
                    return RecoveryResult(candidateUnreadable: true)
                } else {
                    clearCandidate = true
                }
            }
        }
        let indexed = Dictionary(uniqueKeysWithValues: index.items.map { ($0.id, $0) })
        let trash = (try? files.contents(AudioLibraryFolder.trashDirectory)) ?? []
        for tombstone in trash {
            let idText = tombstone.lastPathComponent.components(separatedBy: "--").first ?? ""
            guard let id = UUID(uuidString: idText), let item = indexed[id] else {
                try? files.remove(tombstone)
                continue
            }
            let destination = AudioLibraryFolder.url(for: item)
            if files.exists(destination) {
                try? files.remove(tombstone)
            } else {
                try? files.move(tombstone, destination)
            }
        }
        for staged in (try? files.contents(AudioLibraryFolder.stagingDirectory)) ?? []
            where staged.lastPathComponent != importCandidate?.stagedFileName
        {
            try? files.remove(staged)
        }
        let indexedNames = Set(index.items.map(\.fileName))
        for url in (try? files.contents(AudioLibraryFolder.directory)) ?? []
            where url != AudioLibraryFolder.indexURL &&
            url != AudioLibraryFolder.importCandidateURL &&
            url.lastPathComponent != recoveredCandidate?.item.fileName &&
            !indexedNames.contains(url.lastPathComponent) && files.isRegularFile(url)
        {
            // Never destroy bytes merely because a crash left them unindexed.
            // Quarantine for recovery instead; only explicit transaction files
            // in staging/trash are safe to sweep automatically.
            var destination = AudioLibraryFolder.recoveredDirectory
                .appending(path: url.lastPathComponent)
            if files.exists(destination) {
                destination = AudioLibraryFolder.recoveredDirectory
                    .appending(path: "\(UUID().uuidString)--\(url.lastPathComponent)")
            }
            try? files.move(url, destination)
        }
        return RecoveryResult(
            recoveredCandidate: recoveredCandidate,
            clearCandidate: clearCandidate
        )
    }
}
