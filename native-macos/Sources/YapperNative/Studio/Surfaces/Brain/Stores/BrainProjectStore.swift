import Foundation

/// The Essentials: one read, edits applied locally at once and autosaved.
@MainActor
final class BrainProjectStore: ObservableObject {
    static let shared = BrainProjectStore()

    @Published private(set) var project: BrainProject?
    @Published private(set) var pillars: [BrainPillarDraft] = []
    @Published private(set) var loadError: String?
    @Published private(set) var saveState: BrainSaveState = .idle

    var loading: Bool { project == nil && loadError == nil }

    /// Bumped on every pillar edit, so a save's reply only replaces the list
    /// when nothing was typed while it was in flight.
    private var pillarRevision = 0
    private let saver = BrainAutosaver()

    init() {
        saver.write = { [weak self] _, patch in try await self?.write(patch) }
        saver.onState = { [weak self] in self?.saveState = $0 }
    }

    /// Re-reads the project. Skipped while edits are waiting, so a refresh
    /// never throws away something typed a moment ago.
    func refresh(force: Bool = false) async {
        if force { try? await saver.flush() }
        guard !saver.hasPending else { return }
        do {
            let payload: BrainProjectPayload = try await StudioJSONClient.get("api/project")
            // A save that started meanwhile carries newer text than this read.
            guard !saver.hasPending, saveState != .saving else { return }
            project = payload.project
            pillars = Self.keepingIdentity(of: pillars, in: payload.pillars.map(BrainPillarDraft.init))
            loadError = nil
        } catch {
            if project == nil { loadError = "Your Essentials couldn't be loaded." }
        }
    }

    func update(_ edit: BrainProjectEdit) {
        guard project != nil else { return }
        apply(edit)
        saver.queue("project", edit.patch)
    }

    /// Applies several edits and waits for them to land.
    func updateAndSave(_ edits: [BrainProjectEdit]) async throws {
        guard project != nil else { throw StudioAPIError(status: 0, code: "project_unavailable", message: "Your Essentials haven't loaded yet.") }
        for edit in edits { update(edit) }
        try await saver.flush()
    }

    func retry() async {
        if project == nil {
            await refresh()
        } else {
            try? await saver.flush()
        }
    }

    func flush() async { try? await saver.flush() }

    private func apply(_ edit: BrainProjectEdit) {
        switch edit {
        case .name(let value): project?.name = value
        case .text(let field, let value): project?[field] = value
        case .pillars(let value):
            pillars = value
            pillarRevision += 1
        }
    }

    private func write(_ patch: BrainPatch) async throws {
        let sentRevision = pillarRevision
        let payload: BrainProjectPayload = try await StudioJSONClient.patch("api/project", body: patch)
        if patch["pillars"] != nil, sentRevision == pillarRevision {
            // Server ids for new rows, and the names it cleaned up.
            pillars = Self.keepingIdentity(of: pillars, in: payload.pillars.map(BrainPillarDraft.init))
        }
        BrainPreviewStore.shared.invalidate()
    }

    /// Carries each row's on-screen identity across a reload, so an open row
    /// stays open when the server hands back the same pillar.
    static func keepingIdentity(of old: [BrainPillarDraft], in fresh: [BrainPillarDraft]) -> [BrainPillarDraft] {
        fresh.enumerated().map { index, pillar in
            var pillar = pillar
            let match = old.first { $0.serverID != nil && $0.serverID == pillar.serverID }
                ?? (index < old.count && old[index].name.lowercased() == pillar.name.lowercased() ? old[index] : nil)
            if let match { pillar.localID = match.localID }
            return pillar
        }
    }
}
