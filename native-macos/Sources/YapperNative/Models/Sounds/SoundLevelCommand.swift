import Foundation

/// "Make all the pop sound effects 80%." Which sounds, and how loud.
///
/// Mechanical in the same way `SoundSweep` is, and answered the same way: the
/// sentence carries a number and a name, the app knows which layers those are,
/// and there is nothing in between for a model to be uncertain about.
struct SoundLevelCommand: Equatable, Sendable {
    /// Which sounds it acts on.
    enum Target: Equatable, Sendable {
        /// Every sound effect on the timeline.
        case allSounds
        /// Only the ones that are this effect.
        case effect(String)
        /// The speaker's own track.
        case videoTrack
    }

    let target: Target
    /// A multiple, not a percentage: what everything downstream deals in.
    let volume: Double

    private static let quantifiers = ["all", "every", "each", "the"]

    static func parse(_ instruction: String) -> SoundLevelCommand? {
        let text = instruction.lowercased()
        // A sentence that does not mention loudness at all is not this, whatever
        // else it may say about sounds.
        guard text.contains("volume") || text.contains("loud") || text.contains("quiet")
        else { return nil }
        guard let volume = percentage(in: text) else { return nil }
        guard quantifiers.contains(where: text.contains) else { return nil }

        if let effect = SoundEffectDescriptor.library.first(where: { named(text, $0) }) {
            return SoundLevelCommand(target: .effect(effect.id), volume: volume)
        }
        if text.contains("sound") || text.contains("sfx") || text.contains("effect") {
            return SoundLevelCommand(target: .allSounds, volume: volume)
        }
        if text.contains("video") || text.contains("voice") || text.contains("footage") {
            return SoundLevelCommand(target: .videoTrack, volume: volume)
        }
        return nil
    }

    /// Whether the sentence names this effect, on whole words so "pop" does not
    /// find itself inside "popular".
    private static func named(_ text: String, _ effect: SoundEffectDescriptor) -> Bool {
        let words = Set(
            text.split { !$0.isLetter && !$0.isNumber }.map(String.init)
        )
        if words.contains(effect.id) { return true }
        let name = effect.name.lowercased()
        // A two-word name is matched whole: "camera shutter", not "camera".
        if name.contains(" ") { return text.contains(name) }
        return words.contains(name)
    }

    /// The first number in the sentence, read as a percentage.
    ///
    /// Anything past 200 is refused rather than clamped: somebody who typed
    /// 800 meant something this cannot do, and quietly giving them 200 would
    /// look like it worked.
    private static func percentage(in text: String) -> Double? {
        var digits = ""
        for character in text {
            if character.isNumber {
                digits.append(character)
            } else if !digits.isEmpty {
                break
            }
        }
        guard let percent = Double(digits), percent >= 0, percent <= 200 else { return nil }
        return percent / 100
    }

    /// What the reply says it did.
    var summary: String {
        let level = AudioLevel.percent(volume)
        switch target {
        case .allSounds: return "Every sound effect is now at \(level)%"
        case .videoTrack: return "The video track is now at \(level)%"
        case let .effect(id):
            let name = SoundEffectDescriptor.library.first { $0.id == id }?.name ?? id
            return "Every \(name) is now at \(level)%"
        }
    }
}
