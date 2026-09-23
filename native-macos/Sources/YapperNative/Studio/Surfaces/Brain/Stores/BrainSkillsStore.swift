import Foundation

/// The creator's skills. Same shape as Knowledge: edits autosave per skill,
/// adds, removes and resets go straight to the server.
@MainActor
final class BrainSkillsStore: ObservableObject {
    static let shared = BrainSkillsStore()

    @Published private(set) var skills: [BrainSkill]?
    @Published private(set) var error: String?
    @Published private(set) var saveState: BrainSaveState = .idle
    @Published private(set) var removing: Set<String> = []

    var loading: Bool { skills == nil && error == nil }
    var available: Bool { skills != nil }
    var activeCount: Int { skills?.filter(\.enabled).count ?? 0 }

    private var revision = 0
    private let saver = BrainAutosaver()

    init() {
        saver.write = { id, patch in
            let _: BrainSkillResponse = try await StudioJSONClient.patch("api/brain/skills/\(id)", body: patch)
            BrainPreviewStore.shared.invalidate()
        }
        saver.onState = { [weak self] in self?.saveState = $0 }
    }

    func skill(_ id: String?) -> BrainSkill? {
        guard let id else { return nil }
        return skills?.first { $0.id == id }
    }

    func refresh() async {
        try? await saver.flush()
        let started = revision
        do {
            let response: BrainSkillsResponse = try await StudioJSONClient.get("api/brain/skills")
            if started == revision, !saver.hasPending { skills = response.skills }
            error = nil
        } catch {
            self.error = "Your Skills couldn't be loaded. Try again."
        }
    }

    /// Sends anything still waiting, for when the page goes away.
    func flush() async { try? await saver.flush() }

    func retry() async {
        if saveState == .error { try? await saver.flush() } else { await refresh() }
    }

    func edit(_ id: String, _ edit: BrainSkillEdit) {
        guard !removing.contains(id), let index = skills?.firstIndex(where: { $0.id == id }) else { return }
        revision += 1
        edit.apply(to: &skills![index])
        saver.queue(id, edit.patch)
    }

    /// Writes a new, empty skill and returns it for the editor to open.
    func create() async -> BrainSkill? {
        guard skills != nil else { return nil }
        do {
            let response: BrainSkillResponse = try await StudioJSONClient.post("api/brain/skills", body: ["name": "New skill"])
            revision += 1
            skills?.append(response.skill)
            error = nil
            BrainPreviewStore.shared.invalidate()
            return response.skill
        } catch {
            self.error = "That Skill couldn't be added. Try again."
            return nil
        }
    }

    func remove(_ id: String) async {
        guard !removing.contains(id) else { return }
        removing.insert(id)
        defer { removing.remove(id) }
        saver.discard(id)
        do {
            try? await saver.flush()
            try await StudioJSONClient.delete("api/brain/skills/\(id)")
            revision += 1
            skills?.removeAll { $0.id == id }
            error = nil
            BrainPreviewStore.shared.invalidate()
        } catch {
            self.error = "That Skill couldn't be removed. It is still here."
        }
    }

    /// Restores the catalog's copy. Pending edits land first, so the last
    /// thing typed before Reset can't arrive afterwards and undo it.
    func reset(_ skill: BrainSkill) async throws {
        guard let slug = skill.catalogSlug else { return }
        try await saver.flush()
        let response = try await BrainCatalogStore.install(slug)
        guard let restored = response.skill else {
            throw StudioAPIError(status: 404, code: "catalog_skill_not_found", message: "That skill isn't in the catalog anymore.")
        }
        revision += 1
        if let index = skills?.firstIndex(where: { $0.id == skill.id }) { skills![index] = restored }
        BrainPreviewStore.shared.invalidate()
    }
}
