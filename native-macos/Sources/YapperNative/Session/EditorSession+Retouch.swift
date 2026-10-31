import Foundation

/// The retouch slider, on the clip under the playhead.
extension EditorSession {
    var retouch: ClipRetouch { backgroundClip?.resolvedRetouch ?? .none }

    /// The sliders save on release, through the retouch action Chirpy uses.
    /// Retouching means finding a face on every frame, which is not something
    /// to start over at each pixel of travel.
    func setClearBlemishes(_ strength: Double) async {
        guard let clip = backgroundClip, clip.resolvedRetouch.clearBlemishes != strength else { return }
        await performAppAction(ClipRetouchInput(clipIDs: [clip.id], clearBlemishes: min(1, max(0, strength)), whitenTeeth: nil))
    }

    func setWhitenTeeth(_ strength: Double) async {
        guard let clip = backgroundClip, clip.resolvedRetouch.whitenTeeth != strength else { return }
        await performAppAction(ClipRetouchInput(clipIDs: [clip.id], clearBlemishes: nil, whitenTeeth: min(1, max(0, strength))))
    }
}
