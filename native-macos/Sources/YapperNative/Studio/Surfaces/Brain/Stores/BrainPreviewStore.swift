import Foundation

/// What the AI reads for one surface, re-compiled shortly after the Brain
/// changes. Only fetches while the preview is open.
@MainActor
final class BrainPreviewStore: ObservableObject {
    static let shared = BrainPreviewStore()

    @Published var surface: BrainSurface = .script { didSet { if surface != oldValue { schedule() } } }
    @Published private(set) var preview: BrainPreview?
    @Published private(set) var fetching = false
    @Published private(set) var failed = false

    /// Set by the disclosure; a closed preview costs nothing.
    var isOpen = false { didSet { if isOpen && !oldValue { schedule() } } }

    private var pending: Task<Void, Never>?

    /// Something in the Brain changed on the server.
    func invalidate() {
        if isOpen { schedule() }
    }

    private func schedule() {
        pending?.cancel()
        pending = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await self?.load()
        }
    }

    private func load() async {
        let requested = surface
        fetching = true
        defer { fetching = false }
        do {
            let next: BrainPreview = try await StudioJSONClient.get("api/brain/preview?surface=\(requested.rawValue)")
            guard requested == surface else { return }
            preview = next
            failed = false
        } catch {
            if !Task.isCancelled { failed = true }
        }
    }
}
