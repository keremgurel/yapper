import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

struct OverlayFramingKeyTests {
    let left = OverlayCrop(x: 0, y: 0, width: 0.5, height: 1)
    let right = OverlayCrop(x: 0.5, y: 0, width: 0.5, height: 1)
    let small = OverlayBox(x: 0.1, y: 0.1, width: 0.3, height: 0.4)
    let large = OverlayBox(x: 0.3, y: 0.2, width: 0.6, height: 0.8)

    func animated() -> ProjectOverlay {
        ProjectOverlay(mediaID: UUID(), timelineStart: 10, duration: 4, crop: left,
            track: 2, rotation: 15, keys: [
                OverlayKey(at: 0, box: small, crop: left),
                OverlayKey(at: 4, box: large, crop: right)
            ])
    }

    @Test func interpolatesCropAndPlacementAndHoldsEndpoints() {
        let overlay = animated()
        #expect(OverlayKeyTrack.crop(of: overlay, at: -1) == left)
        #expect(OverlayKeyTrack.crop(of: overlay, at: 5) == right)
        #expect(OverlayKeyTrack.crop(of: overlay, at: 2).x == 0.25)
        let box = OverlayKeyTrack.box(of: overlay, at: 2)
        #expect(abs(box.x - 0.2) < 0.000001)
        #expect(abs(box.width - 0.45) < 0.000001)
    }

    @Test func addingKeySamplesVisibleFrameWithoutChangingAnimation() {
        let original = animated()
        let keyed = OverlayKeyTrack.capturing(at: 2, in: original)
        #expect(keyed.keys?.count == 3)
        for time in stride(from: 0.0, through: 4.0, by: 0.25) {
            let a = OverlayKeyTrack.box(of: original, at: time)
            let b = OverlayKeyTrack.box(of: keyed, at: time)
            #expect(abs(a.width - b.width) < 0.000001)
            #expect(OverlayKeyTrack.crop(of: original, at: time) == OverlayKeyTrack.crop(of: keyed, at: time))
        }
    }

    @Test func changingBoxPreservesCropAtKey() {
        let overlay = animated()
        let changed = OverlayKeyTrack.setting(small, at: 4, in: overlay)
        #expect(OverlayKeyTrack.crop(of: changed, at: 4) == right)
        #expect(OverlayKeyTrack.crop(of: changed, at: 0) == left)
    }

    @Test func cropRequestChangesOnlyItsPortionAndItsKey() {
        let overlay = animated()
        var sibling = overlay
        sibling.id = UUID()
        sibling.timelineStart = 20
        let request = CropRequest(mediaID: overlay.mediaID, name: "chart", overlayIDs: [overlay.id], crop: right, keyTime: 4)
        let crop = OverlayCrop(x: 0.25, y: 0.25, width: 0.5, height: 0.5)
        let changed = request.applying(crop, to: [overlay, sibling])
        #expect(changed[1] == sibling)
        #expect(OverlayKeyTrack.crop(of: changed[0], at: 0) == left)
        #expect(OverlayKeyTrack.crop(of: changed[0], at: 4) == crop)
        #expect(OverlayKeyTrack.box(of: changed[0], at: 4) == large)
    }

    @Test func explicitBatchReplacesCropAnimationButKeepsPositionKeys() {
        let a = animated()
        var b = a; b.id = UUID()
        let request = CropRequest(mediaID: a.mediaID, name: "chart", overlayIDs: [a.id, b.id], crop: .full)
        let changed = request.applying(.full, to: [a, b])
        for overlay in changed {
            #expect(OverlayKeyTrack.crop(of: overlay, at: 2) == .full)
            #expect(overlay.keys?.map(\.box) == a.keys?.map(\.box))
        }
    }

    @Test func staticCropDoesNotTouchAnotherOccurrence() {
        var a = animated(); a.keys = nil
        var b = a; b.id = UUID()
        let request = CropRequest(mediaID: a.mediaID, name: "chart", overlayIDs: [a.id], crop: left)
        let changed = request.applying(right, to: [a, b])
        #expect(changed[0].resolvedCrop == right)
        #expect(changed[1] == b)
    }

    @Test func oldKeysDecodeAndNewKeysRoundTrip() throws {
        let old = "{\"at\":0,\"box\":{\"x\":0,\"y\":0,\"width\":1,\"height\":1}}"
        let key = try JSONDecoder().decode(OverlayKey.self, from: Data(old.utf8))
        #expect(key.crop == nil)
        var overlay = animated(); overlay.keys = [key]
        #expect(OverlayKeyTrack.crop(of: overlay, at: 2) == left)
        let original = animated()
        let data = try JSONEncoder().encode(original)
        #expect(try JSONDecoder().decode(ProjectOverlay.self, from: data) == original)
    }

    @Test func clearingAndRemovingLastKeyHoldTheChosenFraming() {
        let overlay = animated()
        let cleared = OverlayKeyTrack.clearingKeys(at: 2, in: overlay)
        #expect(cleared.keys == nil)
        #expect(cleared.resolvedCrop.x == 0.25)
        #expect(OverlayKeyTrack.box(of: cleared, at: 0) == OverlayKeyTrack.box(of: overlay, at: 2))
        let one = OverlayKeyTrack.removingKey(at: 0, in: overlay)
        let none = OverlayKeyTrack.removingKey(at: 4, in: one)
        #expect(none.resolvedCrop == right)
        #expect(none.keys == nil)
    }

    @Test func splitPreservesAppearanceAndPropertiesOnBothSides() {
        let original = animated()
        let first = OverlayKeyTrack.portion(of: original, from: 0, duration: 2)
        var second = OverlayKeyTrack.portion(of: original, from: 2, duration: 2)
        #expect(second.lane == 2)
        #expect(second.rotation == 15)
        #expect(OverlayKeyTrack.crop(of: first, at: 2) == OverlayKeyTrack.crop(of: second, at: 0))
        #expect(OverlayKeyTrack.box(of: first, at: 2) == OverlayKeyTrack.box(of: second, at: 0))
        second = OverlayKeyTrack.setting(small, at: 0, in: second, crop: .full)
        #expect(OverlayKeyTrack.crop(of: first, at: 2).x == 0.25)
        #expect(OverlayKeyTrack.crop(of: second, at: 0) == .full)
    }

    @Test func trimmingRebasesAndExtendingRestoresKeys() {
        let original = animated()
        let trimmed = TimelineOverlayGeometry.trimmed(overlay: original, edge: .leading,
            translationX: 20, contentWidth: 1000, projectDuration: 100)
        #expect(trimmed.timelineStart == 12)
        #expect(OverlayKeyTrack.crop(of: trimmed, at: 0) == OverlayKeyTrack.crop(of: original, at: 2))
        let restored = TimelineOverlayGeometry.trimmed(overlay: trimmed, edge: .leading,
            translationX: -20, contentWidth: 1000, projectDuration: 100)
        #expect(restored.keys == original.keys)
    }

    @Test func compositorEvaluatesExactMidpointSourceAndDestination() {
        let overlay = animated()
        let motion = OverlayMotion(overlay: overlay, naturalSize: CGSize(width: 400, height: 200),
            preferredTransform: .identity, crop: overlay.resolvedCrop,
            renderSize: CGSize(width: 800, height: 800), mediaAspect: 2)
        #expect(motion.cropRect(atTimeline: 12) == CGRect(x: 100, y: 0, width: 200, height: 200))
        let mapped = motion.cropRect(atTimeline: 12).applying(motion.transform(atTimeline: 12))
        #expect(mapped.width > 0 && mapped.height > 0)
    }
}
