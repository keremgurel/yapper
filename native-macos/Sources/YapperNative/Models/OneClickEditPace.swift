import Foundation

/// How long each step of a one-click edit usually takes, so what the creator
/// watches moves at the rate the work actually happens.
///
/// A spinner that looks identical at twenty seconds and four minutes is the
/// reason the edit feels stuck, and a bar that fills in forty seconds and then
/// sits for another minute is no better. Every figure here is a time taken
/// from the app's own latency log or from the cut harness, with the date it
/// was taken. Nothing here is allowed to claim the step is finished before it
/// is, so being wrong costs a slow bar rather than a lie.
struct OneClickEditPace: Equatable, Sendable {
    /// Words in the transcript, once there is one.
    var words: Int
    /// Running time of the take.
    var mediaSeconds: Double

    static let unknown = OneClickEditPace(words: 0, mediaSeconds: 0)

    /// Seconds this step usually takes on this take.
    func expectedSeconds(for stage: OneClickEditStage) -> Double {
        switch stage {
        case .preparing: 2
        case .transcribing: Self.transcribingFixedSeconds + mediaSeconds * Self.transcribingSecondsPerMediaSecond
        case .removingRetakes: max(Self.shortestRetakeCallSeconds, Self.retakeCallSeconds.value(at: Double(words)))
        // The loudness reading the pause cut needs runs alongside the retake
        // call, so these three took under a second between them on a 24.6
        // minute take.
        case .cuttingPauses, .trimmingSilence, .addingCaptions: 2
        }
    }

    /// One retake call, by words in the take (2026-11-23, gemini-3.7-flash
    /// with the token cap sized to the take).
    ///
    /// Takes of 468 to 619 words came back in 35 to 41 seconds, one of 1,399
    /// words in about 85, and one of 2,891 words in 105, 111 and 131. The call
    /// slows with the room the model is given to think, and the server stops
    /// adding room at about 5,800 words, where a call measured 210 seconds. No
    /// take that long has been run: that figure is the 2,891 word take given
    /// the largest allowance. Nothing under 468 words has been timed either.
    private static let retakeCallSeconds = MeasuredCurve(points: [
        .init(x: 544, y: 38),
        .init(x: 1_399, y: 85),
        .init(x: 2_891, y: 115),
        .init(x: 5_819, y: 210),
    ])
    private static let shortestRetakeCallSeconds = 15.0

    /// Transcribing, from one run (2026-11-23): 52 seconds for a 24.6 minute
    /// take. Reading the audio, encoding it and uploading it took 46 of those
    /// and grow with the take. Waiting for the words took the rest and does
    /// not. The upload is most of it, so a slow connection runs behind this.
    private static let transcribingFixedSeconds = 6.0
    private static let transcribingSecondsPerMediaSecond = 0.031

    /// How far along to draw a step that has been running `elapsed` seconds.
    ///
    /// Approaches the end without arriving. A step that takes twice as long as
    /// expected keeps moving instead of sitting at a full bar, which is the
    /// other way progress stops meaning anything.
    func fraction(for stage: OneClickEditStage, elapsed: Double) -> Double {
        guard elapsed > 0 else { return 0 }
        let expected = expectedSeconds(for: stage)
        guard expected > 0 else { return 0 }
        // Two thirds of the way at the expected time, and asymptotic after.
        // Capped short of full: far past the expected time the curve rounds
        // to exactly one, and a full bar on a step still running is the lie
        // this type exists to avoid.
        return min(0.985, 1 - exp(-elapsed / (expected * 0.9)))
    }
}
