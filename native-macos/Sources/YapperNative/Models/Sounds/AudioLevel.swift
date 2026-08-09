import Foundation

/// How loud something plays, as a multiple of how loud it was recorded.
///
/// One place for the range, because three parts of the app have to agree on it
/// exactly: the fader you drag, the mix the export builds, and the waveform on
/// the timeline. A waveform drawn at a level the mix will not honour is a lie
/// about the video you are about to publish.
enum AudioLevel {
    /// Silent. Kept as a level rather than folded into muting, because they mean
    /// different things: a fader at zero is a mix decision, and muting is a
    /// switch you flick back.
    static let minimum = 0.0
    /// Twice as loud, which is as far as the mix will go before clipping stops
    /// being a risk and becomes a certainty.
    static let maximum = 2.0
    static let unity = 1.0

    static func clamped(_ value: Double) -> Double {
        guard value.isFinite else { return unity }
        return min(maximum, max(minimum, value))
    }

    /// What the fader reads, in the units people actually talk in.
    static func percent(_ value: Double) -> Int {
        Int((clamped(value) * 100).rounded())
    }

    /// A level read back from something typed, or nil when it was not a number.
    ///
    /// Forgiving about what comes with the digits, because a field showing "%"
    /// invites typing one, and pasting "80 %" should not be an argument.
    static func percentTyped(_ text: String) -> Double? {
        let digits = text
            .replacingOccurrences(of: "%", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let percent = Double(digits), percent.isFinite else { return nil }
        return clamped(percent / 100)
    }

    /// How tall to draw a waveform at this level.
    ///
    /// Not the level itself: a track at 150% cannot be drawn half again as tall
    /// as its own row, so past unity the bars saturate rather than overflow the
    /// cell. Everything below unity is exact, which is the half of the range
    /// people are usually working in when they reach for a fader at all.
    static func waveformGain(_ value: Double) -> Double {
        min(unity, clamped(value))
    }
}
