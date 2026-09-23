import Foundation

/// What the teleprompter reads and which content item a take belongs to.
///
/// Another page hands an idea over by writing its id to the
/// `nativeRecorderItemID` default and switching to this tab. The id is taken
/// once, so opening the Recorder later from the sidebar starts clean, and
/// the loaded item stays here for as long as the app runs.
@MainActor
final class RecorderScriptStore: ObservableObject {
    static let shared = RecorderScriptStore()
    static let handoffKey = "nativeRecorderItemID"

    enum LoadState: Equatable {
        case idle
        case loading(String)
        case failed(itemID: String, message: String, missing: Bool)
    }

    @Published private(set) var source: TeleprompterSource?
    @Published private(set) var loadState: LoadState = .idle
    @Published var view: TeleprompterView = .off

    /// The content item a saved take links to, if the words came from one.
    var itemID: String? {
        if case let .item(item) = source { return item.id }
        return nil
    }

    var itemTitle: String? {
        if case let .item(item) = source { return item.title.isEmpty ? nil : item.title }
        return nil
    }

    var promptText: String { source?.text(for: view) ?? "" }

    /// Picks up an id another page left for the Recorder.
    func takeHandoff() async {
        let defaults = UserDefaults.standard
        guard let id = defaults.string(forKey: Self.handoffKey)?.trimmingCharacters(in: .whitespaces),
              !id.isEmpty else { return }
        defaults.removeObject(forKey: Self.handoffKey)
        if itemID == id { return }
        await load(itemID: id)
    }

    func load(itemID id: String) async {
        loadState = .loading(id)
        do {
            let envelope: RecorderContentEnvelope = try await StudioJSONClient.get("api/content/\(id)")
            adopt(.item(envelope.item))
            loadState = .idle
        } catch let error as StudioAPIError {
            let missing = error.status == 404 && error.code != nil
            loadState = .failed(
                itemID: id,
                message: missing
                    ? "This idea is unavailable. It may have been removed. Pick another one or record without a script."
                    : "The script couldn't be loaded. Try again to keep this take linked to its idea.",
                missing: missing
            )
        } catch {
            loadState = .failed(itemID: id, message: "The script couldn't be loaded. Check your connection and try again.", missing: false)
        }
    }

    func retry() async {
        if case let .failed(id, _, _) = loadState { await load(itemID: id) }
    }

    /// Uses text typed or pasted here. A pasted script belongs to no idea,
    /// so a take saved with it becomes its own library item.
    func usePasted(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return clear() }
        adopt(.pasted(trimmed))
    }

    func clear() {
        source = nil
        view = .off
        loadState = .idle
    }

    func isAvailable(_ view: TeleprompterView) -> Bool {
        source?.has(view) ?? (view == .off)
    }

    private func adopt(_ next: TeleprompterSource) {
        source = next
        view = next.defaultView
    }
}
