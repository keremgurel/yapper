import Foundation

/// How long each step of a one-click edit usually takes, so what the creator
/// watches moves at the rate the work actually happens.
///
/// The two slow steps scale with the take, and a spinner that looks identical
/// at twenty seconds and four minutes is the reason the edit feels stuck. The
/// retake pass is measured: the model reads a transcript at about eight words a
/// second, 472 words in half a minute and 1,888 in four. The rest are close
/// enough to name honestly, and nothing here is allowed to claim the step is
/// finished before it is, so being wrong costs a slow bar rather than a lie.
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
        case .transcribing: max(15, mediaSeconds * 0.22)
        case .removingRetakes: max(20, Double(words) * 0.13)
        case .cuttingPauses: max(4, mediaSeconds * 0.06)
        case .trimmingSilence: 3
        case .addingCaptions: 2
        }
    }

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
        return 1 - exp(-elapsed / (expected * 0.9))
    }
}
