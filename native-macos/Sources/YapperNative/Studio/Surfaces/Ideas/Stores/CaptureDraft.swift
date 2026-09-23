import Foundation

/// What is typed in the composer and where the caret is. The text is kept on
/// disk, so a half-typed 11pm thought survives quitting the app.
@MainActor
final class CaptureDraft: ObservableObject {
    static let shared = CaptureDraft()
    private static let key = "yapper.idea.draft"

    @Published var text: String {
        didSet { persist() }
    }
    /// The last caret or selection, in UTF-16 units: dictated words go here.
    @Published var selection = NSRange(location: NSNotFound, length: 0)

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        text = defaults.string(forKey: Self.key) ?? ""
    }

    private let defaults: UserDefaults

    var isEmpty: Bool { text.ideasTrimmed.isEmpty }

    /// Splices dictated words in at the caret and returns the full text.
    @discardableResult
    func insertDictation(_ words: String) -> String {
        let result = CaptureText.insertDictation(words, into: text, selection: selection)
        text = result.text
        selection = NSRange(location: result.caret, length: 0)
        return result.text
    }

    func clear() {
        text = ""
        selection = NSRange(location: 0, length: 0)
    }

    private func persist() {
        if text.isEmpty { defaults.removeObject(forKey: Self.key) } else { defaults.set(text, forKey: Self.key) }
    }
}
