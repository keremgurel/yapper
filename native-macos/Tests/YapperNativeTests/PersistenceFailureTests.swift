@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

private actor TestProjectStore: ProjectPersisting {
    enum Failure: LocalizedError {
        case diskFull
        case unreadable

        var errorDescription: String? {
            switch self {
            case .diskFull: "The test disk is full."
            case .unreadable: "The saved project is unreadable."
            }
        }
    }

    var loadedProject: EditorProject?
    var loadFailure: Failure?
    var saveFailure: Failure?
    private(set) var saveAttempts = 0
    private(set) var savedProjects: [EditorProject] = []
    private var shouldBlockNextSave = false
    private var blockedSave: CheckedContinuation<Void, Never>?
    private var saveAttemptWaiters: [(count: Int, continuation: CheckedContinuation<Void, Never>)] = []

    init(
        loadedProject: EditorProject? = nil,
        loadFailure: Failure? = nil,
        saveFailure: Failure? = nil
    ) {
        self.loadedProject = loadedProject
        self.loadFailure = loadFailure
        self.saveFailure = saveFailure
    }

    func load() async throws -> EditorProject? {
        if let loadFailure { throw loadFailure }
        return loadedProject
    }

    func save(_ project: EditorProject) async throws {
        saveAttempts += 1
        let ready = saveAttemptWaiters.filter { saveAttempts >= $0.count }
        saveAttemptWaiters.removeAll { saveAttempts >= $0.count }
        for waiter in ready { waiter.continuation.resume() }
        if shouldBlockNextSave {
            shouldBlockNextSave = false
            await withCheckedContinuation { blockedSave = $0 }
        }
        if let saveFailure { throw saveFailure }
        savedProjects.append(project)
    }

    func snapshot() -> (attempts: Int, projects: [EditorProject]) {
        (saveAttempts, savedProjects)
    }

    func setSaveFailure(_ failure: Failure?) {
        saveFailure = failure
    }

    func blockNextSave() {
        shouldBlockNextSave = true
    }

    func waitForSaveAttempt(_ count: Int) async {
        guard saveAttempts < count else { return }
        await withCheckedContinuation { continuation in
            saveAttemptWaiters.append((count, continuation))
        }
    }

    func releaseBlockedSave() {
        blockedSave?.resume()
        blockedSave = nil
    }
}

private actor TestOverlayPlacementService: OverlayPlacementPlanning {
    let planResult: OverlayPlacementService.Plan

    init(planResult: OverlayPlacementService.Plan) {
        self.planResult = planResult
    }

    func plan(
        instruction _: String,
        words _: [String],
        files _: [OverlayPlacementService.File],
        frameAspect _: Double,
        speaker _: [SpeakerSample],
        placed _: [OverlayPlacementService.Placed]
    ) async throws -> OverlayPlacementService.Plan {
        planResult
    }
}

@Suite(.serialized)
@MainActor
struct PersistenceFailureTests {
    @Test("Persistence propagates the storage error")
    func persistPropagatesFailure() async {
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)
        var receivedFailure: TestProjectStore.Failure?
        do {
            try await session.persist()
        } catch let failure as TestProjectStore.Failure {
            receivedFailure = failure
        } catch {
            Issue.record("Unexpected error: \(error)")
        }

        #expect(receivedFailure == .diskFull)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
        #expect(saved.projects.isEmpty)
    }

    @Test("A failed UI save is never announced or recorded as committed")
    func failedChangeStaysVisible() async {
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)
        await session.commitTimelineEdit(requiresRebuild: false, successStatus: "Saved") {
            session.updateProject { $0.name = "Unsaved title" }
            return true
        }

        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        #expect(!session.canUndo)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
        #expect(saved.projects.isEmpty)
    }

    @Test("A successful UI save records history and announces success")
    func successfulChangeCommits() async {
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        await session.commitTimelineEdit(requiresRebuild: false, successStatus: "Saved") {
            session.updateProject { $0.name = "Durable title" }
            return true
        }

        #expect(session.statusMessage == "Saved")
        #expect(session.errorMessage == nil)
        #expect(session.canUndo)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
        #expect(saved.projects.map(\.name) == ["Durable title"])
    }

    @Test("A debounced visual save cannot overwrite its storage failure with Ready")
    func debouncedFailureStaysVisible() async {
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)
        let before = session.project

        session.scheduleVisualCommit {
            session.updateProject { $0.name = "Unsaved debounce" }
            return true
        }
        _ = await session.commitTimelineEdit(requiresRebuild: false) { false }

        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        #expect(session.project == before)
        #expect(!session.canUndo)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
    }

    @Test("A visual edit cannot downgrade a pending composition rebuild")
    func visualEditPreservesPendingRebuild() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let original = try await videoProject(in: directory, name: "Original", sourceEnd: 0.9)
        await session.commitTimelineEdit {
            session.updateProject { $0 = original }
            return true
        }

        session.scheduleCompositionCommit(settleFor: .milliseconds(40)) {
            session.updateProject { $0.clips[0].sourceEnd = 0.45 }
            return true
        }
        session.scheduleVisualCommit {
            session.updateProject { $0.name = "Trimmed and titled" }
            return true
        }
        _ = await session.commitTimelineEdit(requiresRebuild: false) { false }

        #expect(session.project.name == "Trimmed and titled")
        #expect(abs(session.project.duration - 0.45) < 0.001)
        #expect(abs(try await playerDuration(session) - 0.45) < 0.05)
        #expect(session.canUndo)
        let saved = await store.snapshot()
        #expect(saved.attempts == 2)
        #expect(saved.projects.last?.name == "Trimmed and titled")
    }

    @Test("Queued gestures retain user order ahead of a later immediate edit")
    func queuedGesturePrecedesImmediateWaiter() async throws {
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        await store.blockNextSave()

        let first = Task { @MainActor in
            await session.commitTimelineEdit {
                session.updateProject { $0.name = "A" }
                return true
            }
        }
        await store.waitForSaveAttempt(1)

        session.scheduleVisualCommit {
            session.updateProject { $0.name += "B" }
            return true
        }
        let third = Task { @MainActor in
            await session.commitTimelineEdit {
                session.updateProject { $0.name += "C" }
                return true
            }
        }
        await store.releaseBlockedSave()
        _ = await first.value
        _ = await third.value

        #expect(session.project.name == "ABC")
        let saved = await store.snapshot()
        #expect(saved.projects.map(\.name) == ["A", "AB", "ABC"])
        #expect(session.statusMessage == "Ready")
    }

    @Test("Queued double toggles preserve parity and eventual status")
    func queuedDoubleTogglePreservesParity() async {
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let overlay = ProjectOverlay(
            mediaID: UUID(),
            timelineStart: 0,
            duration: 1,
            track: 0
        )
        session.updateProject { $0.overlays = [overlay] }
        await store.blockNextSave()
        let blocker = Task { @MainActor in
            await session.commitTimelineEdit(requiresRebuild: false) {
                session.updateProject { $0.name = "Blocking" }
                return true
            }
        }
        await store.waitForSaveAttempt(1)

        session.toggleVideoTrackHidden()
        session.toggleVideoTrackHidden()
        session.toggleVideoTrackMuted()
        session.toggleVideoTrackMuted()
        session.toggleOverlayTrackHidden(0)
        session.toggleOverlayTrackHidden(0)
        await store.releaseBlockedSave()
        _ = await blocker.value
        _ = await session.commitTimelineEdit(requiresRebuild: false) { false }

        #expect(!session.project.isVideoTrackHidden)
        #expect(!session.project.isVideoTrackMuted)
        #expect(session.project.overlays?.first?.isVisible == true)
        #expect(session.statusMessage == "Overlay track shown")
        let saved = await store.snapshot()
        #expect(saved.projects.last?.isVideoTrackHidden == false)
        #expect(saved.projects.last?.isVideoTrackMuted == false)
        #expect(saved.projects.last?.overlays?.first?.isVisible == true)
    }

    @Test("Queued caption toggles preserve stored-caption parity")
    func queuedCaptionTogglesPreserveParity() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        var original = try await videoProject(
            in: directory,
            name: "Captioned",
            transcriptRanges: [(0.2, 0.4)]
        )
        original.regenerateCaptions()
        await session.commitTimelineEdit {
            session.updateProject { $0 = original }
            return true
        }
        await store.blockNextSave()
        let blocker = Task { @MainActor in
            await session.commitTimelineEdit(requiresRebuild: false) {
                session.updateProject { $0.name = "Blocking" }
                return true
            }
        }
        await store.waitForSaveAttempt(2)
        let first = Task { @MainActor in await session.toggleCaptions() }
        let second = Task { @MainActor in await session.toggleCaptions() }
        await store.releaseBlockedSave()
        _ = await blocker.value
        await first.value
        await second.value

        #expect(session.project.captionsEnabled == true)
        #expect(session.project.storedCaptions.count == 1)
        #expect(session.statusMessage == "Captions shown · 1 card")
        let saved = await store.snapshot()
        #expect(saved.projects.suffix(2).map { $0.captionsEnabled == true } == [false, true])
    }

    @Test("Queued no-caption toggles generate once then hide")
    func queuedNoCaptionTogglesDoNotDuplicateGeneration() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let original = try await videoProject(
            in: directory,
            name: "Transcript only",
            transcriptRanges: [(0.2, 0.4)]
        )
        await session.commitTimelineEdit {
            session.updateProject { $0 = original }
            return true
        }
        await store.blockNextSave()
        let blocker = Task { @MainActor in
            await session.commitTimelineEdit(requiresRebuild: false) {
                session.updateProject { $0.name = "Blocking" }
                return true
            }
        }
        await store.waitForSaveAttempt(2)
        let first = Task { @MainActor in await session.toggleCaptions() }
        let second = Task { @MainActor in await session.toggleCaptions() }
        await store.releaseBlockedSave()
        _ = await blocker.value
        await first.value
        await second.value

        #expect(session.project.captionsEnabled == false)
        #expect(session.project.storedCaptions.count == 1)
        #expect(session.statusMessage == "Captions hidden · 1 card kept")
        let saved = await store.snapshot()
        #expect(saved.projects.suffix(2).map { $0.captionsEnabled == true } == [true, false])
    }

    @Test("An immediate false mutation restores model and UI state")
    func immediateFalseMutationRollsBack() async {
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let before = session.project

        let success = await session.commitTimelineEdit(requiresRebuild: false) {
            session.updateProject { $0.name = "Leaked" }
            session.mediaSelection = session.mediaSelection.selecting([UUID()])
            return false
        }

        #expect(!success)
        #expect(session.project == before)
        #expect(session.mediaSelection == .empty)
        let saved = await store.snapshot()
        #expect(saved.attempts == 0)
    }

    @Test("A scheduled false mutation preserves an earlier accepted gesture")
    func scheduledFalseMutationRollsBackOnlyItself() async {
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        session.scheduleVisualCommit {
            session.updateProject { $0.name = "Accepted" }
            return true
        }
        session.scheduleVisualCommit {
            session.updateProject { $0.name = "Leaked" }
            session.setSelectedCaptionIDs([UUID()])
            return false
        }
        _ = await session.commitTimelineEdit(requiresRebuild: false) { false }

        #expect(session.project.name == "Accepted")
        #expect(session.selectedCaptionIDs.isEmpty)
        let saved = await store.snapshot()
        #expect(saved.projects.map(\.name) == ["Accepted"])
    }

    @Test("A pending gesture is durable before a discrete caption edit")
    func pendingGesturePrecedesCaptionEdit() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let original = try await videoProject(in: directory, name: "Original")
        await session.commitTimelineEdit {
            session.updateProject { $0 = original }
            return true
        }

        session.scheduleVisualCommit {
            session.updateProject { $0.name = "Pending title" }
            return true
        }
        await session.addCaptionAtPlayhead()

        #expect(session.project.name == "Pending title")
        #expect(session.project.captionEntries.count == 1)
        let saved = await store.snapshot()
        #expect(saved.projects.suffix(2).map(\.name) == ["Pending title", "Pending title"])
        #expect(saved.projects.last?.captionEntries.count == 1)
    }

    @Test("A queued sweep resolves moments after earlier serialized edits")
    func queuedSweepUsesCurrentMoments() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let original = try await videoProject(in: directory, name: "Original")
        await session.commitTimelineEdit {
            session.updateProject { $0 = original }
            return true
        }
        await store.blockNextSave()
        let blocker = Task { @MainActor in
            await session.commitTimelineEdit(requiresRebuild: false) {
                session.updateProject { $0.name = "Blocking" }
                return true
            }
        }
        await store.waitForSaveAttempt(2)
        session.scheduleCompositionCommit(settleFor: .milliseconds(30)) {
            let clip = session.project.clips[0]
            session.updateProject {
                $0.clips = [
                    TimelineClip(mediaID: clip.mediaID, sourceStart: 0, sourceEnd: 0.45),
                    TimelineClip(mediaID: clip.mediaID, sourceStart: 0.45, sourceEnd: 0.9),
                ]
            }
            return true
        }
        let sweep = Task { @MainActor in
            await session.placeOverlaysWithAI(instruction: "add a pop sound to every cut")
        }
        await store.releaseBlockedSave()
        _ = await blocker.value
        await sweep.value

        #expect(session.project.clips.count == 2)
        #expect(session.project.audioLayers?.count == 1)
        if case let .placed(notes) = session.overlayPlacement {
            #expect(notes.count == 1)
        } else {
            Issue.record("Sweep was reported before its durable transaction completed")
        }
    }

    @Test("Queued edits resolve stable IDs after an earlier removal")
    func queuedEditResolvesIDAfterRemoval() async {
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let first = ProjectTextLayer(text: "First", timelineStart: 0, duration: 1)
        let second = ProjectTextLayer(text: "Second", timelineStart: 1, duration: 1)
        await session.commitTimelineEdit(requiresRebuild: false) {
            session.updateProject { $0.textLayers = [first, second] }
            return true
        }
        await store.blockNextSave()

        let blocker = Task { @MainActor in
            await session.commitTimelineEdit(requiresRebuild: false) {
                session.updateProject { $0.name = "Blocking" }
                return true
            }
        }
        await store.waitForSaveAttempt(2)
        session.scheduleVisualCommit {
            session.updateProject { $0.textLayers?.removeAll { $0.id == first.id } }
            return true
        }
        var updated = second
        updated.text = "Updated second"
        session.updateTextLayer(updated)

        await store.releaseBlockedSave()
        _ = await blocker.value
        _ = await session.commitTimelineEdit(requiresRebuild: false) { false }

        #expect(session.project.textLayers?.map(\.id) == [second.id])
        #expect(session.project.textLayers?.map(\.text) == ["Updated second"])
    }

    @Test("A failed second dropped file restores the first partial import")
    func secondDroppedFileFailureRollsBackFirst() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let first = directory.appending(path: "first.mov")
        let broken = directory.appending(path: "broken.mov")
        try await SyntheticVideo.write(
            color: CGColor(red: 0.2, green: 0.3, blue: 0.4, alpha: 1),
            size: CGSize(width: 320, height: 180),
            to: first
        )
        try Data("not a movie".utf8).write(to: broken)
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let before = session.project

        await session.importDropped(
            [first, broken],
            onto: TimelineDropTarget(track: .video(insertionIndex: 0), start: 0, snap: nil),
            at: 0
        )

        #expect(session.project == before)
        #expect(session.player.currentItem == nil)
        #expect(session.selectedClipID == nil)
        #expect(session.timelineSelection.isEmpty)
        #expect(session.thumbnailsByMedia.isEmpty)
        #expect(session.waveformByMedia.isEmpty)
        #expect(session.waveformProgressByMedia.isEmpty)
        #expect(session.statusMessage == "Needs attention")
        #expect(!session.canUndo)
    }

    @Test("A dropped multi-file save failure restores the whole project")
    func droppedFilesSaveFailureRollsBackAll() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let first = directory.appending(path: "first.mov")
        let second = directory.appending(path: "second.mov")
        for (url, red) in [(first, 0.2), (second, 0.7)] {
            try await SyntheticVideo.write(
                color: CGColor(red: red, green: 0.3, blue: 0.4, alpha: 1),
                size: CGSize(width: 320, height: 180),
                to: url
            )
        }
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)
        let before = session.project

        await session.importDropped(
            [first, second],
            onto: TimelineDropTarget(track: .video(insertionIndex: 0), start: 0, snap: nil),
            at: 0
        )

        #expect(session.project == before)
        #expect(session.player.currentItem == nil)
        #expect(session.selectedClipID == nil)
        #expect(session.timelineSelection.isEmpty)
        #expect(session.thumbnailsByMedia.isEmpty)
        #expect(session.waveformByMedia.isEmpty)
        #expect(session.waveformProgressByMedia.isEmpty)
        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        #expect(!session.canUndo)
    }

    @Test("An AI placement save failure restores model player and selection")
    func aiPlacementSaveFailureRollsBackAll() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let planner = TestOverlayPlacementService(
            planResult: .init(
                placements: [],
                sounds: [],
                texts: [TextRequest(text: "Hook", quote: "word0")]
            )
        )
        let store = TestProjectStore()
        let session = EditorSession(store: store, overlayPlacementService: planner)
        let original = try await videoProject(
            in: directory,
            name: "Original",
            transcriptRanges: [(0.2, 0.4)]
        )
        await session.commitTimelineEdit {
            session.updateProject { $0 = original }
            return true
        }
        let selected = session.project.clips[0].id
        session.selectTimelineItem(.clip(selected))
        session.seekToTimelineTime(0.7)
        let before = session.project
        await store.setSaveFailure(.diskFull)

        await session.placeOverlaysWithAI(instruction: "add text over word0")

        #expect(session.project == before)
        #expect(session.selectedClipID == selected)
        #expect(session.timelineSelection == [.clip(selected)])
        #expect(abs(session.currentTime - 0.7) < 0.05)
        #expect(abs(try await playerDuration(session) - before.duration) < 0.05)
        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
    }

    @Test("A failed level command is never reported as placed")
    func levelCommandWaitsForDurability() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let original = try await videoProject(in: directory, name: "Original")
        await session.commitTimelineEdit {
            session.updateProject { $0 = original }
            return true
        }
        await store.setSaveFailure(.diskFull)

        await session.placeOverlaysWithAI(instruction: "set the video volume to 70%")

        #expect(session.project.resolvedVideoTrackVolume == 1)
        if case let .failed(message) = session.overlayPlacement {
            #expect(message == "The test disk is full.")
        } else {
            Issue.record("A failed save was reported as a placed assistant edit")
        }
        #expect(session.errorMessage == "The test disk is full.")
    }

    @Test("A failed overlay deletion restores it and keeps the error visible")
    func failedOverlayDeletionDoesNotAnnounceSuccess() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        var original = try await videoProject(in: directory, name: "Overlay")
        let overlay = ProjectOverlay(
            mediaID: original.media[0].id,
            timelineStart: 0.1,
            duration: 0.4
        )
        original.overlays = [overlay]
        await session.commitTimelineEdit {
            session.updateProject { $0 = original }
            return true
        }
        await store.setSaveFailure(.diskFull)

        await session.deleteOverlay(overlay.id)

        #expect(session.project.overlays?.map(\.id) == [overlay.id])
        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
    }

    @Test("A failed composition gesture restores model player playhead and selection")
    func failedCompositionGestureRollsBack() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let original = try await videoProject(in: directory, name: "Original", sourceEnd: 0.9)
        await session.commitTimelineEdit {
            session.updateProject { $0 = original }
            return true
        }
        let before = session.project
        let selected = before.clips[0].id
        session.selectTimelineItem(.clip(selected))
        session.seekToTimelineTime(0.75)
        await store.setSaveFailure(.diskFull)

        session.scheduleCompositionCommit(settleFor: .milliseconds(30)) {
            session.updateProject { $0.clips[0].sourceEnd = 0.4 }
            session.seekToTimelineTime(0.2)
            return true
        }
        _ = await session.commitTimelineEdit(requiresRebuild: false) { false }

        #expect(session.project == before)
        #expect(session.selectedClipID == selected)
        #expect(session.timelineSelection == [.clip(selected)])
        #expect(abs(session.currentTime - 0.75) < 0.05)
        #expect(abs(try await playerDuration(session) - 0.9) < 0.05)
        #expect(session.statusMessage == "Needs attention")
        #expect(session.canUndo)
    }

    @Test("A timeline commit cannot report Ready after storage fails")
    func timelineCommitFailureStaysVisible() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)
        let project = try await videoProject(in: directory, name: "Unsaved edit")
        await session.commitTimelineEdit {
            session.updateProject { $0 = project }
            return true
        }

        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        #expect(!session.canUndo)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
        #expect(saved.projects.isEmpty)
    }

    @Test("Termination flushes the latest debounced gesture without waiting")
    func terminationFlushesPendingGesture() async {
        let store = TestProjectStore()
        let session = EditorSession(store: store)

        session.scheduleVisualCommit {
            session.updateProject { $0.name = "Last gesture" }
            return true
        }
        let shouldTerminate = await session.prepareForTermination()

        #expect(shouldTerminate)
        #expect(session.project.name == "Last gesture")
        #expect(session.canUndo)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
        #expect(saved.projects.map(\.name) == ["Last gesture"])
    }

    @Test("Termination is cancelled when the latest gesture cannot be saved")
    func terminationCancelsOnSaveFailure() async {
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)
        let before = session.project

        session.scheduleVisualCommit {
            session.updateProject { $0.name = "Unsaved last gesture" }
            return true
        }
        let shouldTerminate = await session.prepareForTermination()

        #expect(!shouldTerminate)
        #expect(session.project == before)
        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
        #expect(saved.projects.isEmpty)
    }

    @Test("Termination waits for an in-flight save and then flushes its queued gesture")
    func terminationPreservesQueuedGestureOrder() async {
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        await store.blockNextSave()

        let first = Task { @MainActor in
            await session.commitTimelineEdit(requiresRebuild: false) {
                session.updateProject { $0.name = "A" }
                return true
            }
        }
        await store.waitForSaveAttempt(1)
        session.scheduleVisualCommit {
            session.updateProject { $0.name += "B" }
            return true
        }
        let termination = Task { @MainActor in
            await session.prepareForTermination()
        }

        await store.releaseBlockedSave()
        _ = await first.value
        let shouldTerminate = await termination.value

        #expect(shouldTerminate)
        #expect(session.project.name == "AB")
        let saved = await store.snapshot()
        #expect(saved.projects.map(\.name) == ["A", "AB"])
    }

    @Test("Recovery still persists a project with no timeline clips")
    func emptyTimelineRecoveryPropagatesSaveFailure() async {
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)

        var receivedFailure: TestProjectStore.Failure?
        do {
            try await session.reloadAfterRecovery()
        } catch let failure as TestProjectStore.Failure {
            receivedFailure = failure
        } catch {
            Issue.record("Unexpected error: \(error)")
        }

        #expect(receivedFailure == .diskFull)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
    }

    @Test("A failed undo restores the live project and keeps the undo available")
    func failedUndoRestoresHistory() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let original = try await videoProject(in: directory, name: "Original", sourceEnd: 0.45)
        await session.commitTimelineEdit {
            session.updateProject { $0 = original }
            return true
        }
        await session.commitTimelineEdit {
            session.updateProject {
                $0.name = "Current"
                $0.clips[0].sourceEnd = 0.9
            }
            return true
        }
        session.seekToTimelineTime(0.8)
        #expect(session.canUndo)
        #expect(abs(try await playerDuration(session) - 0.9) < 0.05)
        await store.setSaveFailure(.diskFull)

        await session.undo()

        #expect(session.project.name == "Current")
        #expect(abs(session.project.duration - 0.9) < 0.001)
        #expect(abs(session.currentTime - 0.8) < 0.05)
        #expect(abs(try await playerDuration(session) - 0.9) < 0.05)
        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        #expect(session.canUndo)
        #expect(!session.canRedo)
    }

    @Test("A failed undo back to an empty project clears the player again")
    func failedUndoRestoresEmptyPlayer() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let nonempty = try await videoProject(in: directory, name: "Footage")
        await session.commitTimelineEdit {
            session.updateProject { $0 = nonempty }
            return true
        }
        await session.commitTimelineEdit {
            session.updateProject { $0 = EditorProject(name: "Empty") }
            return true
        }
        #expect(session.player.currentItem == nil)
        await store.setSaveFailure(.diskFull)

        await session.undo()

        #expect(session.project.clips.isEmpty)
        #expect(session.player.currentItem == nil)
        #expect(session.statusMessage == "Needs attention")
        #expect(session.canUndo)
    }

    @Test("A failed auto-trim restores both the project and the live composition")
    func failedAutoTrimRestoresPlayer() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let project = try await videoProject(
            in: directory,
            name: "Untrimmed",
            sourceEnd: 0.9,
            transcriptRanges: [(0.2, 0.3), (0.7, 0.8)]
        )
        var splitProject = project
        splitProject.clips = [
            TimelineClip(mediaID: project.media[0].id, sourceStart: 0, sourceEnd: 0.45),
            TimelineClip(mediaID: project.media[0].id, sourceStart: 0.45, sourceEnd: 0.9),
        ]
        await session.commitTimelineEdit {
            session.updateProject { $0 = splitProject }
            return true
        }
        let before = session.project
        let selected = before.clips[1].id
        session.selectTimelineItem(.clip(selected))
        session.seekToTimelineTime(0.75)
        #expect(abs(try await playerDuration(session) - before.duration) < 0.05)
        await store.setSaveFailure(.diskFull)

        await session.autoTrimSilences()

        #expect(session.project == before)
        #expect(session.selectedClipID == selected)
        #expect(session.timelineSelection == [.clip(selected)])
        #expect(abs(session.currentTime - 0.75) < 0.05)
        #expect(abs(try await playerDuration(session) - before.duration) < 0.05)
        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        #expect(session.canUndo)
    }

    @Test("Restore failures come from the injected store and stay visible")
    func restoreFailureIsReported() async throws {
        let store = TestProjectStore(loadFailure: .unreadable)
        let session = EditorSession(store: store)

        try await Task.sleep(for: .milliseconds(50))

        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The saved project is unreadable.")
    }

    private func videoProject(
        in directory: URL,
        name: String,
        sourceEnd: Double = 0.9,
        transcriptRanges: [(Double, Double)] = []
    ) async throws -> EditorProject {
        let source = directory.appending(path: "source.mov")
        try await SyntheticVideo.write(
            color: CGColor(red: 0.2, green: 0.3, blue: 0.4, alpha: 1),
            size: CGSize(width: 320, height: 180),
            to: source
        )
        let media = try await MediaProbe.inspect(url: source)
        return EditorProject(
            name: name,
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: sourceEnd)],
            transcript: transcriptRanges.enumerated().map { index, range in
                TranscriptWord(
                    mediaID: media.id,
                    text: "word\(index)",
                    start: range.0,
                    end: range.1
                )
            }
        )
    }

    private func playerDuration(_ session: EditorSession) async throws -> Double {
        guard let asset = session.player.currentItem?.asset else {
            throw TestProjectStore.Failure.unreadable
        }
        return try await asset.load(.duration).seconds
    }

    private func temporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-persistence-tests-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}
