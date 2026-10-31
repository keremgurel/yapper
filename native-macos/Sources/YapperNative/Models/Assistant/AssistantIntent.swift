import Foundation

/// What the assistant was asked to do.
///
/// The editor already knows how to transcribe, cut a rough take down, trim the
/// silences and caption a video. Asking for those in words should reach the same
/// code the buttons reach — anything else and the box is a toy that can only do
/// the one thing it was built for.
enum AssistantIntent: Equatable, Sendable {
    case transcribe
    case oneClickEdit
    case trimSilences
    case generateCaptions
    case hideCaptions
    case showCaptions
    case addHook
    /// Put the named files over the speaker. The instruction goes to the model
    /// whole, because where an overlay belongs is a judgement, not a command.
    case placeOverlays
    /// Drop sound effects on moments of the edit. The same pass as placing
    /// overlays, because "a pop when the icons show" is one sentence about one
    /// moment, and splitting it in two would ask the model the same question
    /// twice.
    case addSounds
    /// Draw words over the video at moments of the speech. The same pass again,
    /// and for the same reason: "put 44% on screen when I say it" is a question
    /// about a moment in the transcript, which is the question that pass asks.
    case placeText
    /// Set how loud something plays.
    case setLevels
    case clipControls
    /// Nothing here matches. Better to say so than to guess and run an edit
    /// nobody asked for.
    case unknown

    /// What the assistant says it is about to do.
    var spoken: String {
        switch self {
        case .transcribe: "Transcribing your audio…"
        case .oneClickEdit: "Cutting retakes and pauses, then captioning…"
        case .trimSilences: "Trimming the silent gaps…"
        case .generateCaptions: "Building caption cards from the transcript…"
        case .hideCaptions: "Hiding the captions…"
        case .showCaptions: "Showing the captions…"
        case .addHook: "Adding a hook at the playhead…"
        case .placeOverlays: "Reading the transcript and choosing the moments…"
        case .addSounds: "Finding the moments those sounds belong on…"
        case .placeText: "Finding the moments those words belong on…"
        case .setLevels: "Setting the levels…"
        case .clipControls: "Updating clip and caption settings…"
        case .unknown:
            "I can edit, transcribe, trim silences, caption, place your overlays, put text on screen, or add sounds."
        }
    }

    /// What it says once the work has landed. Past tense and specific, because
    /// a reply is the only evidence you get that your video changed without
    /// going to look for it.
    var settled: String {
        switch self {
        case .transcribe: "Transcribed. The words are in the transcript panel."
        case .oneClickEdit: "Edited: retakes and pauses cut, captions on."
        case .trimSilences: "Trimmed the silent gaps."
        case .generateCaptions: "Built the caption cards from your transcript."
        case .hideCaptions: "Captions hidden."
        case .showCaptions: "Captions are showing again."
        case .addHook: "Added a hook at the playhead."
        // These three never get here: the overlay pass reports its own
        // changes, line by line, and `AssistantReply.toPlacement` speaks for
        // them.
        case .placeOverlays, .addSounds, .placeText, .setLevels, .clipControls: "Done."
        case .unknown: spoken
        }
    }
}

/// What stays of the old sentence matcher: brand setup is still routed to the
/// Studio kit before Chirpy plans. Everything else is planned from context.
enum AssistantRouter {
    /// Brand setup belongs to the persistent Studio kit even while editing a
    /// video. Visual requests that merely use a brand stay in the editor.
    static func requestsBrandKit(_ instruction: String) -> Bool {
        let text = instruction.lowercased()
        let patterns = [
            #"\b(?:my|our)\s+(?:brand\s+)?colou?rs?\s+(?:are|is|:)"#,
            #"\b(?:set|save|remember|change|update|create|build|set up)\s+(?:(?:my|our|the)\s+)?(?:brand(?:\s+kit|\s+colou?rs?)?|palette)\b"#,
            #"\b(?:show|open|put up|pull up|bring up|view)\s+(?:me\s+)?(?:(?:my|our|the)\s+)?(?:brand\s+kit|brand\s+colou?rs?|palette)\s*[.!?]?$"#,
            #"\b(?:add|remove|delete)\s+.+\s+(?:to|from)\s+(?:(?:my|our|the)\s+)?(?:brand\s+kit|brand\s+colou?rs?|palette)\s*[.!?]?$"#,
        ]
        return patterns.contains { text.range(of: $0, options: .regularExpression) != nil }
    }
}
