import Foundation

/// What an empty conversation with Chirpy offers, by where it is open.
struct AssistantEmptyContent: Equatable {
    var hint: String
    var examples: [String]
    var showsOverlaySuggestion: Bool
    /// The box's placeholder, when it differs from the default.
    var placeholder: String?

    static let editor = AssistantEmptyContent(
        hint: "Ask for an edit, or say where your overlays go.",
        examples: ["Trim the silent gaps", "Add captions", "Cut the retakes"],
        showsOverlaySuggestion: true
    )

    static let studio = AssistantEmptyContent(
        hint: "Change what Yapper knows, or start something anywhere in Studio.",
        examples: ["Add context", "Change my voice", "Create an idea"],
        showsOverlaySuggestion: false
    )

    /// Simple mode: the edit a creator talking to camera wants, and a hint
    /// that anything more is one sentence away.
    static let simple = AssistantEmptyContent(
        hint: "Say what you want. Anything the editor can do, Chirpy can do from here, from a hook to a split screen.",
        examples: ["Cut the retakes", "Bigger captions", "Add a hook", "Split screen when I show the chart"],
        showsOverlaySuggestion: false,
        placeholder: "Cut the retakes and make the captions bigger"
    )
}
