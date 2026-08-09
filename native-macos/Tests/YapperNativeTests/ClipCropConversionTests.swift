import CoreGraphics
import Foundation
import Testing

@testable import YapperNative

/// A main-track clip stores a zoom and an offset, not a rectangle. The crop
/// editor speaks rectangles, so the two have to mean exactly the same thing in
/// both directions or reopening a crop shows something other than what was set.
struct ClipCropConversionTests {
    private let portrait = 9.0 / 16.0
    private let landscape = 16.0 / 9.0

    private func close(_ a: Double, _ b: Double, _ tolerance: Double = 0.001) -> Bool {
        abs(a - b) < tolerance
    }

    private func close(_ a: OverlayCrop, _ b: OverlayCrop, _ tolerance: Double = 0.001) -> Bool {
        close(a.x, b.x, tolerance) && close(a.y, b.y, tolerance)
            && close(a.width, b.width, tolerance) && close(a.height, b.height, tolerance)
    }

    /// Untouched framing on footage shot for the frame shows all of it.
    @Test func identityFramingOnMatchingShapesShowsTheWholePicture() {
        let crop = ClipCropConversion.crop(
            from: .identity,
            sourceAspect: portrait,
            frameAspect: portrait
        )
        #expect(close(crop, .full))
    }

    /// Landscape footage fitted into a portrait frame is letterboxed, so the
    /// frame still shows the whole width and the whole height of the picture.
    /// The bars are not source, so the visible rectangle is still everything.
    @Test func fittedFootageOfAnotherShapeStillShowsAllOfItself() {
        let crop = ClipCropConversion.crop(
            from: .identity,
            sourceAspect: landscape,
            frameAspect: portrait
        )
        #expect(close(crop, .full))
    }

    /// Zooming in halves what is on screen, about the middle.
    @Test func zoomingInNarrowsTheVisibleRectangleAroundTheCentre() {
        let crop = ClipCropConversion.crop(
            from: VideoFraming(scale: 2, x: 0, y: 0),
            sourceAspect: portrait,
            frameAspect: portrait
        )
        #expect(close(crop.width, 0.5))
        #expect(close(crop.height, 0.5))
        #expect(close(crop.x, 0.25))
        #expect(close(crop.y, 0.25))
    }

    @Test func slidingThePictureMovesTheVisibleRectangleTheOtherWay() {
        let crop = ClipCropConversion.crop(
            from: VideoFraming(scale: 2, x: 0.1, y: 0),
            sourceAspect: portrait,
            frameAspect: portrait
        )
        // The picture went right, so what the frame sees is further left.
        #expect(crop.x < 0.25)
    }

    /// The round trip that matters: set a rectangle, store it as a framing,
    /// read it back, and get the rectangle. Only ever asked of frame-shaped
    /// rectangles, which is all the editor produces for a clip.
    @Test func aFrameShapedRectangleSurvivesTheRoundTrip() {
        let cases: [(source: Double, frame: Double)] = [
            (portrait, portrait),
            (landscape, portrait),
            (portrait, landscape),
            (1, portrait),
            (landscape, landscape),
        ]
        for shapes in cases {
            for wanted in [
                OverlayCrop(x: 0, y: 0, width: 1, height: 1),
                OverlayCrop(x: 0.1, y: 0.2, width: 0.5, height: 0.5),
                OverlayCrop(x: 0.3, y: 0.05, width: 0.4, height: 0.6),
            ] {
                let shaped = ClipCropConversion.frameShaped(
                    wanted,
                    sourceAspect: shapes.source,
                    frameAspect: shapes.frame
                )
                let framing = ClipCropConversion.framing(
                    for: shaped,
                    sourceAspect: shapes.source,
                    frameAspect: shapes.frame
                )
                let back = ClipCropConversion.crop(
                    from: framing,
                    sourceAspect: shapes.source,
                    frameAspect: shapes.frame
                )
                #expect(
                    close(back, shaped, 0.005),
                    "\(shapes) lost \(shaped) and got \(back)"
                )
            }
        }
    }

    /// A clip's crop always has the output frame's shape, because what survives
    /// is whatever the frame lands on. There is no framing that shows a square
    /// of a landscape clip with black around it.
    @Test func aClipsRectangleIsAlwaysTheShapeOfTheFrame() {
        let shaped = ClipCropConversion.frameShaped(
            OverlayCrop(x: 0.1, y: 0.1, width: 0.8, height: 0.3),
            sourceAspect: landscape,
            frameAspect: portrait
        )
        // Real shape of the kept rectangle: source aspect times its own ratio.
        let realAspect = landscape * (shaped.width / shaped.height)
        #expect(close(realAspect, portrait, 0.01))
    }

    /// The zoom is clamped, so past a point a rectangle is one the clip cannot
    /// store. The editor has to stop there rather than accept a number that
    /// will be quietly turned into a different one.
    @Test func theSmallestStorableRectangleIsReportedHonestly() {
        let minimum = ClipCropConversion.minimumSide(
            sourceAspect: portrait,
            frameAspect: portrait
        )
        #expect(close(minimum, 1 / VideoFraming.maximumScale, 0.01))

        // A rectangle at exactly that size round-trips; the framing it needs is
        // the ceiling itself rather than something past it.
        let crop = OverlayCrop(
            x: (1 - minimum) / 2,
            y: (1 - minimum) / 2,
            width: minimum,
            height: minimum
        )
        let framing = ClipCropConversion.framing(
            for: crop,
            sourceAspect: portrait,
            frameAspect: portrait
        )
        #expect(close(framing.scale, VideoFraming.maximumScale, 0.01))
    }

    @Test func nonsenseShapesGiveTheWholePictureRatherThanCrashing() {
        #expect(close(ClipCropConversion.crop(from: .identity, sourceAspect: 0, frameAspect: 1), .full))
        #expect(
            ClipCropConversion.framing(
                for: OverlayCrop(x: 0, y: 0, width: 0, height: 0),
                sourceAspect: 1,
                frameAspect: 1
            ) == .identity
        )
    }
}
