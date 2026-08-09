import Foundation
import Testing
@testable import YapperNative

/// What a crop editor opens on, when the thing right-clicked was a file rather
/// than one of the cutaways made from it.
struct CropRequestTests {
    private let mediaID = UUID()

    private func overlay(start: Double, crop: OverlayCrop? = nil) -> ProjectOverlay {
        var overlay = ProjectOverlay(mediaID: mediaID, timelineStart: start, duration: 2)
        overlay.crop = crop
        return overlay
    }

    @Test func aFileNotOnTheTimelineHasNothingToCrop() {
        #expect(CropRequest.make(mediaID: mediaID, name: "chart.png", overlays: []) == nil)
    }

    @Test func oneCutawayIsEditedFromWhereItAlreadyIs() {
        let crop = OverlayCrop(x: 0.1, y: 0.2, width: 0.5, height: 0.5)
        let request = CropRequest.make(
            mediaID: mediaID,
            name: "chart.png",
            overlays: [overlay(start: 1, crop: crop)]
        )
        #expect(request?.crop == crop)
        #expect(request?.isMultiple == false)
        #expect(request?.subtitle == "One cutaway")
    }

    /// Cropping a screenshot in the bin means every place it appears, and when
    /// they already agree there is a crop to start from.
    @Test func cutawaysThatAgreeAreEditedTogetherFromTheirSharedCrop() {
        let crop = OverlayCrop(x: 0, y: 0.25, width: 1, height: 0.5)
        let request = CropRequest.make(
            mediaID: mediaID,
            name: "chart.png",
            overlays: [overlay(start: 1, crop: crop), overlay(start: 5, crop: crop)]
        )
        #expect(request?.crop == crop)
        #expect(request?.overlayIDs.count == 2)
        #expect(request?.isMultiple == true)
    }

    /// When the same file has been cropped differently in two places, there is
    /// no shared crop to start from, and picking one of them would silently
    /// throw the other away the moment anything was dragged.
    @Test func cutawaysThatDisagreeStartFromTheWholePicture() {
        let request = CropRequest.make(
            mediaID: mediaID,
            name: "chart.png",
            overlays: [
                overlay(start: 1, crop: OverlayCrop(x: 0, y: 0, width: 0.5, height: 0.5)),
                overlay(start: 5, crop: OverlayCrop(x: 0.5, y: 0.5, width: 0.5, height: 0.5)),
            ]
        )
        #expect(request?.crop == .full)
    }

    @Test func anUncroppedCutawayStartsFromTheWholePicture() {
        let request = CropRequest.make(
            mediaID: mediaID,
            name: "chart.png",
            overlays: [overlay(start: 1)]
        )
        #expect(request?.crop == .full)
    }
}
