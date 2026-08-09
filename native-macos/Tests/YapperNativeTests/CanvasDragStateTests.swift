import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// The drag has to survive the views being rebuilt underneath it, which is the
/// whole reason it lives on the session now.
@MainActor
struct CanvasDragStateTests {
    private func overlay(x: Double, y: Double) -> ProjectOverlay {
        ProjectOverlay(mediaID: UUID(), timelineStart: 0, duration: 2, x: x, y: y)
    }

    @Test func aDraftBelongsOnlyToTheItemBeingDragged() {
        let drag = CanvasDragState()
        let dragged = overlay(x: 0.2, y: 0.2)
        drag.beginOverlay(dragged)
        drag.updateOverlay({ var moved = dragged; moved.x = 0.8; return moved }())

        #expect(drag.overlayDraft(for: dragged.id)?.x == 0.8)
        #expect(drag.overlayDraft(for: UUID()) == nil)
    }

    @Test func everyStepMeasuresFromWhereTheDragBegan() {
        let drag = CanvasDragState()
        let start = overlay(x: 0.3, y: 0.3)
        drag.beginOverlay(start)
        drag.updateOverlay({ var moved = start; moved.x = 0.9; return moved }())

        // The origin is untouched by the steps, so a drag cannot compound.
        #expect(drag.overlayOrigin?.x == 0.3)
    }

    @Test func endingHandsBackTheLastDraftAndForgetsIt() {
        let drag = CanvasDragState()
        let dragged = overlay(x: 0.1, y: 0.1)
        drag.beginOverlay(dragged)
        drag.updateOverlay({ var moved = dragged; moved.y = 0.7; return moved }())

        #expect(drag.endOverlay()?.y == 0.7)
        #expect(drag.overlay == nil)
        #expect(drag.overlayOrigin == nil)
        #expect(drag.endOverlay() == nil)
    }

    @Test func aCaptionDragKeepsItsWidthWhileItMoves() {
        let drag = CanvasDragState()
        let id = UUID()
        drag.beginCaption(.init(id: id, x: 0.5, y: 0.8, width: 0.6))
        drag.updateCaption(.init(id: id, x: 0.4, y: 0.2, width: 0.6))

        let draft = drag.captionDraft(for: id)
        #expect(draft?.y == 0.2)
        #expect(draft?.width == 0.6)
    }

    @Test func draggingOneThingDoesNotOfferADraftForAnother() {
        let drag = CanvasDragState()
        let layer = ProjectTextLayer(text: "Hook", timelineStart: 0, duration: 3)
        drag.beginText(layer)

        #expect(drag.textDraft(for: layer.id) != nil)
        #expect(drag.captionDraft(for: UUID()) == nil)
        #expect(drag.overlayDraft(for: UUID()) == nil)
    }
}

/// The framing drag is the odd one out: the composition on screen is still
/// showing an older framing, so the player has to be pushed the rest of the way
/// by hand. What the drag itself owes is the gesture bookkeeping.
@MainActor
struct VideoFramingDragTests {
    @Test func everyStepOfAFramingGestureMeasuresFromWhereItBegan() {
        let drag = CanvasDragState()
        let origin = VideoFraming(scale: 1.5, x: 0.2, y: -0.1)
        drag.beginFraming(origin, clipID: UUID(), from: CGPoint(x: 10, y: 10))
        drag.updateFraming(VideoFraming(scale: 3, x: 0.4, y: 0.3))

        #expect(drag.framingOrigin == origin)
        #expect(drag.framing?.scale == 3)
        #expect(drag.framingStart == CGPoint(x: 10, y: 10))
    }

    /// The drag that replaces a cancelled one carries on from what the picture
    /// has become, or the resize pops back to where it all started.
    @Test func aReplacementGestureKeepsWhatThePictureHas() {
        let drag = CanvasDragState()
        let clipID = UUID()
        drag.beginFraming(.identity, clipID: clipID, from: CGPoint(x: 10, y: 10))
        drag.updateFraming(VideoFraming(scale: 2, x: 0, y: 0))

        let carried = try! #require(drag.framing)
        drag.beginFraming(carried, clipID: clipID, from: CGPoint(x: 80, y: 80))
        #expect(drag.framingOrigin?.scale == 2)
        #expect(drag.framingStart == CGPoint(x: 80, y: 80))
    }

    @Test func theCommitLandsOnTheClipTheGestureStartedOver() {
        let drag = CanvasDragState()
        let clipID = UUID()
        drag.beginFraming(.identity, clipID: clipID, from: .zero)
        drag.updateFraming(VideoFraming(scale: 2, x: 0, y: 0))

        let finished = drag.endFraming()
        #expect(finished?.clipID == clipID)
        #expect(finished?.framing.scale == 2)
        // And the drag is over: nothing left behind to leak into the next one.
        #expect(drag.framing == nil)
        #expect(drag.framingOrigin == nil)
        #expect(drag.framingClipID == nil)
        #expect(drag.framingStart == nil)
    }
}

/// What the composition is rendering, which is what the preview transform is
/// measured against.
@MainActor
struct RenderedFramingStoreTests {
    @Test func aClipTheCompositionHasNeverSeenIsFitted() {
        let store = RenderedFramingStore()
        #expect(store.framing(for: UUID()) == .identity)
    }

    @Test func recordingTakesTheFramingEachClipCarried() {
        let store = RenderedFramingStore()
        var clip = TimelineClip(mediaID: UUID(), sourceStart: 0, sourceEnd: 5)
        clip.framing = VideoFraming(scale: 2, x: 0.1, y: 0)
        store.record([clip])

        #expect(store.framing(for: clip.id) == VideoFraming(scale: 2, x: 0.1, y: 0))
    }

    @Test func clipsThatAreGoneAreForgotten() {
        let store = RenderedFramingStore()
        let clip = TimelineClip(mediaID: UUID(), sourceStart: 0, sourceEnd: 5)
        store.record([clip])
        store.record([])

        #expect(store.byClip.isEmpty)
    }
}
