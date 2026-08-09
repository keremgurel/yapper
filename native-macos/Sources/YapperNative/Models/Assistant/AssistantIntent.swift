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
    /// Set how loud something plays. Answered without a model at all: which
    /// sounds and what level is the whole of the sentence. See
    /// `SoundLevelCommand`.
    case setLevels
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
        case .placeOverlays, .addSounds, .placeText, .setLevels: "Done."
        case .unknown: spoken
        }
    }
}

/// Reads an instruction and picks the editor command it is asking for.
///
/// Deliberately a plain matcher rather than a model call: these are the app's
/// own verbs, the creator is looking at the buttons that carry the same words,
/// and a local answer is instant and free. Anything it cannot place falls
/// through to the overlay pass, which does involve the model — that is the one
/// job here that genuinely needs judgement.
enum AssistantRouter {
    /// - Parameter mentionsFile: true when the sentence names a file with `@`,
    ///   which settles it: naming a file is asking for that file to be placed.
    static func route(_ instruction: String, mentionsFile: Bool = false) -> AssistantIntent {
        let text = instruction.lowercased()
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return .unknown }
        if mentionsFile { return .placeOverlays }

        // Order matters: the more specific reading of a sentence wins. "Edit
        // this and add captions" is the one-click pass, not two separate asks.
        if matches(text, all: ["caption"], any: ["hide", "turn off", "remove", "without", "no "]) {
            return .hideCaptions
        }
        if matches(text, all: ["caption"], any: ["show", "turn on", "bring back", "put back"]) {
            return .showCaptions
        }
        if matches(text, any: ["one click", "1 click", "one-click", "1-click"]) {
            return .oneClickEdit
        }
        // A sentence asking for the whole treatment, however it is phrased.
        if matches(text, any: ["clean this up", "clean it up", "tidy this up", "edit this", "edit the video", "edit my video", "do everything", "full edit"]) {
            return .oneClickEdit
        }
        if matches(text, any: ["retake", "mistake", "flub", "stumble", "false start"]) {
            return .oneClickEdit
        }
        if matches(text, any: ["silence", "silent", "dead air", "gap", "pause"]) {
            return .trimSilences
        }
        if matches(text, any: ["transcribe", "transcript", "timed words", "subtitle the audio"]) {
            return .transcribe
        }
        if matches(text, any: ["caption", "subtitle"]) {
            return .generateCaptions
        }
        if matches(text, any: ["hook", "title card", "headline"]) {
            return .addHook
        }
        // Before the overlay matcher, because "put 44% on screen" is both a
        // "put" and a text, and text is the specific reading. Both go to the
        // same pass in the end; what this settles is what gets said out loud
        // and whether a sentence about words is refused for having no media.
        if namesOnScreenText(text) { return .placeText }
        if matches(text, any: ["overlay", "cutaway", "b-roll", "b roll", "show ", "put ", "place "]) {
            return .placeOverlays
        }
        // Asked of the command itself, so the router and the thing that carries
        // it out cannot disagree about what a level sentence looks like. Before
        // the sound words, because "make the video volume 70%" names no sound
        // at all and would otherwise fall through to nothing at all.
        if SoundLevelCommand.parse(instruction) != nil { return .setLevels }
        // Last, and only when nothing above claimed the sentence. "A pop when
        // the icons show" is an overlay sentence that happens to name a sound,
        // and the overlay is the part that has to land in the right place.
        if namesAnEffect(text) { return .addSounds }
        return .unknown
    }

    /// Words that only ever mean a sound effect.
    ///
    /// Matched on whole words, because half of them are short enough to live
    /// inside an ordinary one: "popular" is not a pop, and "clicks" in "the
    /// thumbnail clicks" is not a click track.
    private static let effectWords: Set<String> = [
        "sfx", "sound", "sounds", "pop", "pops", "whoosh", "whooshes", "swoosh",
        "woosh", "riser", "risers", "click", "clicks", "shutter", "chaching",
        "ching", "ding", "boom", "sting", "drumroll", "applause", "cheer",
        "airhorn", "effect", "effects",
    ]

    /// Words that mean words on the screen.
    ///
    /// Matched whole, like the effect words and for the same reason: "textures"
    /// is not text, and "labelling" a clip in the bin is not a label on the
    /// picture. "Caption" is deliberately absent — that is the caption track,
    /// which is a different feature with its own button.
    private static let textWords: Set<String> = [
        "text", "texts", "label", "labels", "labeled", "labelled", "wording",
    ]

    private static func namesOnScreenText(_ text: String) -> Bool {
        wholeWords(of: text).contains { textWords.contains($0) }
    }

    private static func wholeWords(of text: String) -> [String] {
        text.lowercased()
            .split { !$0.isLetter && !$0.isNumber }
            .map(String.init)
    }

    private static func namesAnEffect(_ text: String) -> Bool {
        wholeWords(of: text).contains { effectWords.contains($0) }
    }

    /// True when the text carries every word in `all` and at least one in `any`.
    /// An empty list is not a condition, so either side can be left out.
    private static func matches(
        _ text: String,
        all: [String] = [],
        any: [String] = []
    ) -> Bool {
        guard all.allSatisfy({ text.contains($0) }) else { return false }
        return any.isEmpty || any.contains { text.contains($0) }
    }
}
