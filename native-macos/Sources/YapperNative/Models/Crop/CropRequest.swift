import Foundation

/// What a crop editor is open on.
///
/// One portion by default. Multiple IDs are an explicit batch operation.
struct CropRequest: Equatable, Identifiable, Sendable {
    var id: UUID { mediaID }
    let mediaID: UUID
    /// What the file is called, for the sheet's title.
    let name: String
    /// Every cutaway the crop will be written to, in timeline order.
    let overlayIDs: [UUID]
    /// The crop they are all showing now, when they agree on one. They disagree
    /// only when the same file has been cropped differently in two places, and
    /// then editing starts from the whole picture rather than from one of them.
    let crop: OverlayCrop
    /// Pinned local time, so an edit cannot land on a different moment if the
    /// playback clock changes while the modal is open. nil means static/batch.
    var keyTime: Double? = nil

    var isMultiple: Bool { overlayIDs.count > 1 }

    /// What the sheet says it is about to change.
    var subtitle: String {
        switch overlayIDs.count {
        case 0: "Not on the timeline yet"
        case 1: "This overlay portion only"
        default: "\(overlayIDs.count) cutaways, all together"
        }
    }

    func applying(_ crop: OverlayCrop, to overlays: [ProjectOverlay]) -> [ProjectOverlay] {
        let targets = Set(overlayIDs)
        let crop = crop.clamped
        return overlays.map { overlay in
            guard targets.contains(overlay.id) else { return overlay }
            if !isMultiple, let keyTime, OverlayKeyTrack.isKeyed(overlay) {
                let time = min(overlay.duration, max(0, keyTime))
                return OverlayKeyTrack.setting(
                    OverlayKeyTrack.box(of: overlay, at: time), at: time, in: overlay, crop: crop
                )
            }
            var result = overlay
            result.crop = crop.isFull ? nil : crop
            // Explicit static/batch changes replace crop animation, never box motion.
            result.keys = result.keys?.map { key in
                var key = key
                key.crop = crop
                return key
            }
            return result
        }
    }

    /// The request for a set of overlays, or nil when there is nothing to crop.
    ///
    /// - Parameter overlays: every overlay of this media, in timeline order.
    static func make(mediaID: UUID, name: String, overlays: [ProjectOverlay]) -> CropRequest? {
        guard !overlays.isEmpty else { return nil }
        let crops = overlays.map(\.resolvedCrop)
        let shared = crops.dropFirst().allSatisfy { $0 == crops[0] } ? crops[0] : .full
        return CropRequest(
            mediaID: mediaID,
            name: name,
            overlayIDs: overlays.map(\.id),
            crop: shared
        )
    }
}
