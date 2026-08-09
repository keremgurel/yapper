import Foundation

/// A sound the model asked for, before anything has checked it exists.
struct SoundRequest: Equatable, Sendable {
    /// What it called the effect. Matched against the shipped library, never
    /// trusted as a file name.
    let effect: String
    /// The sentence to look in, when this sound belongs to a moment of speech.
    let quote: String?
    /// The word inside that sentence it lands on.
    let cue: String?
    /// `cut` when it belongs at every cut in the edit rather than at a word.
    let every: String?
    /// A time in seconds, when the creator named one themselves. Only ever
    /// honoured if they really did: see `SoundPlan.statedTimes`.
    let at: Double?

    init(
        effect: String,
        quote: String? = nil,
        cue: String? = nil,
        every: String? = nil,
        at: Double? = nil
    ) {
        self.effect = effect
        self.quote = quote
        self.cue = cue
        self.every = every
        self.at = at
    }
}

/// Turning "add a pop" into one of the eighteen sounds the app actually ships.
///
/// The model names an effect in whatever words it likes and the library is
/// fixed, so everything here is a lookup with a hard floor: a name that matches
/// nothing comes back as nothing. There is no nearest-guess, because a
/// cha-ching where somebody asked for an airhorn is worse than silence and a
/// line saying it could not be found.
enum SoundPlan {
    /// Names a creator or a model reaches for that are not the library's own.
    /// Small on purpose: this is for the obvious synonyms, not a thesaurus.
    private static let aliases: [String: String] = [
        "shutter": "camera-shutter",
        "camera": "camera-shutter",
        "camera click": "camera-shutter",
        "photo": "shutter-snap",
        "snap": "shutter-snap",
        "click": "mouse-click",
        "ding": "pop",
        "bubble": "pop",
        "swoosh": "swoosh",
        "woosh": "whoosh",
        "transition": "whoosh",
        "cash": "cha-ching",
        "money": "cha-ching",
        "kaching": "cha-ching",
        "sparkle": "magic-reveal",
        "reveal": "magic-reveal",
        "cheer": "crowd-cheer",
        "applause": "crowd-cheer",
        "typing": "keyboard-typing",
        "riser": "metal-riser",
        "drumroll": "drum-roll",
    ]

    /// The effect a name refers to, or nil when the library has nothing like it.
    ///
    /// Tried in order of how certain each match is: the library's own id, its
    /// name, an alias, and only then a name that contains a library name, which
    /// is what catches "a quick pop sound".
    static func effect(named name: String) -> SoundEffectDescriptor? {
        let wanted = normalized(name)
        guard !wanted.isEmpty else { return nil }
        let library = SoundEffectDescriptor.library

        if let hit = library.first(where: { normalized($0.id) == wanted }) { return hit }
        if let hit = library.first(where: { normalized($0.name) == wanted }) { return hit }
        if let id = aliases[wanted], let hit = library.first(where: { $0.id == id }) { return hit }

        // Longest first, so "cheek pop" inside a sentence never loses to "pop".
        let byLength = library.sorted { $0.name.count > $1.name.count }
        if let hit = byLength.first(where: { wanted.contains(normalized($0.name)) }) { return hit }
        return byLength.first { wanted.contains(normalized($0.id)) }
    }

    /// What a request means to repeat itself over, when it does.
    ///
    /// The model may answer "every cut" or "every overlay"; both are questions
    /// the app can answer exactly and it cannot, because it is never told where
    /// the cuts are or what is already on the timeline.
    enum Every: Equatable, Sendable {
        case cut
        case overlay
    }

    static func every(_ request: SoundRequest) -> Every? {
        guard let every = request.every else { return nil }
        let text = normalized(every)
        if text.contains("overlay") || text.contains("cutaway") || text.contains("broll") {
            return .overlay
        }
        if text.contains("cut") || text.contains("edit") || text.contains("clip") {
            return .cut
        }
        return nil
    }

    /// Whether a request belongs at every cut rather than at a word.
    static func isEveryCut(_ request: SoundRequest) -> Bool {
        every(request) == .cut
    }

    /// Where the cuts are, in timeline seconds.
    ///
    /// The joins between clips, and never zero: the start of the video is not a
    /// cut, and a whoosh on the first frame is just a whoosh over the hook.
    static func cutTimes(clipDurations: [Double]) -> [Double] {
        guard clipDurations.count > 1 else { return [] }
        var times: [Double] = []
        var cursor = 0.0
        for duration in clipDurations.dropLast() {
            cursor += max(0, duration)
            times.append(cursor)
        }
        return times
    }

    /// Pull the standalone sounds out of a reply's `sounds` array, dropping
    /// anything that does not at least name an effect.
    static func parseRequests(_ raw: [Any]) -> [SoundRequest] {
        raw.compactMap { entry in
            guard
                let entry = entry as? [String: Any],
                let effect = entry["effect"] as? String,
                !effect.trimmingCharacters(in: .whitespaces).isEmpty
            else { return nil }
            return SoundRequest(
                effect: effect,
                quote: entry["quote"] as? String,
                cue: entry["cue"] as? String,
                every: entry["every"] as? String,
                at: (entry["at"] as? NSNumber)?.doubleValue
            )
        }
    }

    /// How far a model's `at` may be from the time the creator actually typed
    /// before it stops being the same moment.
    static let statedTimeTolerance = 0.25

    /// Every time the creator named in their own sentence, in seconds.
    ///
    /// This is the whole reason `at` is allowed to exist. Everywhere else the
    /// model is kept away from seconds, because counting them is exactly what it
    /// cannot do. But "add a cha-ching at 0:12" is not the model counting: the
    /// number is sitting in the instruction, and copying it out is the same kind
    /// of job as copying out a quote. So the numbers are read here too, and an
    /// `at` that matches none of them is a number nobody asked for.
    ///
    /// Understood: `0:12`, `1:05:30`, `12s`, `12 sec`, `12 seconds`, `2 minutes`.
    static func statedTimes(in instruction: String) -> [Double] {
        instruction
            .matches(of: timePattern)
            .compactMap { parseTime(String(instruction[$0.range])) }
    }

    /// The time a request lands on, when the creator really did name one.
    static func statedTime(for request: SoundRequest, in instruction: String) -> Double? {
        guard let at = request.at, at.isFinite, at >= 0 else { return nil }
        let stated = statedTimes(in: instruction)
        return stated.contains { abs($0 - at) <= statedTimeTolerance } ? at : nil
    }

    /// Clock times first, so `1:05` is not read as the number 1 followed by 05.
    ///
    /// Built per call rather than held: a `Regex` is not `Sendable`, and this
    /// runs once per instruction rather than once per frame.
    private static var timePattern: some RegexComponent {
        #/(\d{1,2}(?::\d{1,2}){1,2})|(\d+(?:\.\d+)?\s*(?:seconds|second|secs|sec|s|minutes|minute|mins|min|m)\b)/#
    }

    private static func parseTime(_ text: String) -> Double? {
        let trimmed = text.trimmingCharacters(in: .whitespaces).lowercased()
        if trimmed.contains(":") {
            // Read right to left, so both m:ss and h:mm:ss work.
            let parts = trimmed.split(separator: ":").compactMap { Double($0) }
            guard parts.count >= 2, parts.count <= 3 else { return nil }
            return parts.reduce(0) { $0 * 60 + $1 }
        }
        let digits = trimmed.prefix { $0.isNumber || $0 == "." }
        guard let value = Double(digits) else { return nil }
        let unit = trimmed.dropFirst(digits.count).trimmingCharacters(in: .whitespaces)
        return unit.hasPrefix("m") ? value * 60 : value
    }

    /// Two sounds this close together are one sound twice, which is a flam
    /// rather than an accent.
    static let minimumGap = 0.08

    /// The times that survive, in order, with anything landing on top of
    /// something already placed dropped.
    static func spaced(_ times: [Double]) -> [Double] {
        var kept: [Double] = []
        for time in times.sorted() where !kept.contains(where: { abs($0 - time) < minimumGap }) {
            kept.append(time)
        }
        return kept
    }

    private static func normalized(_ text: String) -> String {
        let stripped = text.lowercased().map { character -> Character in
            character.isLetter || character.isNumber ? character : " "
        }
        let words = String(stripped)
            .split(whereSeparator: \.isWhitespace)
            .map(String.init)
            // "a pop sound", "the whoosh effect": the noise around the name.
            .filter { !["a", "an", "the", "sound", "sounds", "effect", "effects", "sfx"].contains($0) }
        return words.joined(separator: " ")
    }
}
