import Foundation

/// "A mixture of pop, swoosh and camera shutter on every overlay."
///
/// A sentence with no judgement left in it: it names the sounds and it names
/// what to hang them on, and the app knows where those things are. Asking a
/// model would be paying for an answer we already have, and it gets it wrong in
/// a particular way that is worth avoiding: the model is never told what is
/// already on the timeline, so "every overlay we have" reads to it as a request
/// to place those overlays, and it dutifully places them again.
///
/// Anything less mechanical than this still goes to the model, which is what it
/// is for.
struct SoundSweep: Equatable, Sendable {
    enum Target: Equatable, Sendable {
        /// Every cutaway on the timeline, as it appears.
        case overlays
        /// Every join between clips.
        case cuts
    }

    /// In the order they were named, which is the order they are dealt out.
    let effects: [SoundEffectDescriptor]
    let target: Target

    /// Words that mean "all of them".
    private static let quantifiers = ["every", "each", "all ", "any "]
    private static let overlayWords = ["overlay", "cutaway", "b-roll", "b roll", "cut away"]
    private static let cutWords = ["cut", "clip", "edit point", "transition"]

    /// The sweep a sentence is asking for, or nil when it is asking for
    /// something that needs thinking about.
    static func parse(_ instruction: String) -> SoundSweep? {
        let text = instruction.lowercased()
        guard mentionsSound(text) else { return nil }
        guard quantifiers.contains(where: text.contains) else { return nil }

        let target: Target
        if overlayWords.contains(where: text.contains) {
            target = .overlays
        } else if cutWords.contains(where: text.contains) {
            target = .cuts
        } else {
            return nil
        }

        let effects = named(in: text)
        guard !effects.isEmpty else { return nil }
        return SoundSweep(effects: effects, target: target)
    }

    /// Which effect goes on the nth thing.
    ///
    /// Dealt round in order, so "a mixture of pop, swoosh and camera shutter"
    /// is a mixture rather than all three landing on top of each other. One
    /// effect named is that effect every time, which is the same rule.
    func effect(at index: Int) -> SoundEffectDescriptor {
        effects[index % effects.count]
    }

    /// Whether the sentence is about sound at all. Without this, "put every
    /// overlay in" would parse as a sweep of no effects.
    private static func mentionsSound(_ text: String) -> Bool {
        ["sound", "sfx", "effect", "audio"].contains { text.contains($0) }
    }

    /// The library's own effects, in the order the sentence names them.
    ///
    /// Matched on the longest name first, so "camera shutter" is one effect
    /// rather than a camera and a shutter, and "cheek pop" beats "pop".
    private static func named(in text: String) -> [SoundEffectDescriptor] {
        var found: [(position: Int, effect: SoundEffectDescriptor)] = []
        var claimed: [Range<String.Index>] = []

        let candidates = SoundEffectDescriptor.library
            .flatMap { effect in [effect.name.lowercased(), effect.id].map { ($0, effect) } }
            .sorted { $0.0.count > $1.0.count }

        for (needle, effect) in candidates {
            var searchStart = text.startIndex
            while let range = text.range(of: needle, range: searchStart ..< text.endIndex) {
                searchStart = range.upperBound
                // A longer name has already taken these characters: "shutter"
                // inside "camera shutter" is not a second effect.
                guard !claimed.contains(where: { $0.overlaps(range) }) else { continue }
                guard !found.contains(where: { $0.effect.id == effect.id }) else { continue }
                claimed.append(range)
                found.append((text.distance(from: text.startIndex, to: range.lowerBound), effect))
            }
        }
        return found.sorted { $0.position < $1.position }.map(\.effect)
    }
}
