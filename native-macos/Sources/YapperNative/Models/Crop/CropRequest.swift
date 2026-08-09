import Foundation

/// What a crop editor is open on.
///
/// A crop belongs to an overlay: it is the part of that cutaway's picture the
/// finished video shows. But the thing a creator right-clicks is often the file
/// in the bin rather than one of the cutaways made from it, and "crop this
/// screenshot" plainly means every place it appears. So a request names the
/// media and carries the overlays it turned out to mean.
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

    var isMultiple: Bool { overlayIDs.count > 1 }

    /// What the sheet says it is about to change.
    var subtitle: String {
        switch overlayIDs.count {
        case 0: "Not on the timeline yet"
        case 1: "One cutaway"
        default: "\(overlayIDs.count) cutaways, all together"
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
