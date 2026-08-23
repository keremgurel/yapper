import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

struct VideoFramingTests {
    private let stage = CGSize(width: 1_000, height: 1_000)

    // MARK: - The value

    @Test func aFramingCannotBeBuiltOutOfRange() {
        let huge = VideoFraming(scale: 99, x: 12, y: -12)
        #expect(huge.scale == VideoFraming.maximumScale)
        #expect(huge.x == VideoFraming.maximumOffset)
        #expect(huge.y == -VideoFraming.maximumOffset)

        let tiny = VideoFraming(scale: 0, x: 0, y: 0)
        #expect(tiny.scale == VideoFraming.minimumScale)
    }

    @Test func aClipSavedBeforeFramingExistedIsFitted() {
        let clip = TimelineClip(mediaID: UUID(), sourceStart: 0, sourceEnd: 5)
        #expect(clip.framing == nil)
        #expect(clip.resolvedFraming == .identity)
        #expect(clip.resolvedFraming.percent == 100)
    }

    @Test func framingSurvivesASaveAndAReload() throws {
        var clip = TimelineClip(mediaID: UUID(), sourceStart: 0, sourceEnd: 5)
        clip.framing = VideoFraming(scale: 1.4, x: 0.1, y: -0.2)
        let data = try JSONEncoder().encode(clip)
        let restored = try JSONDecoder().decode(TimelineClip.self, from: data)
        #expect(restored.resolvedFraming == clip.resolvedFraming)
    }

    // MARK: - Panning

    @Test func panningMovesThePictureByTheDrag() {
        let panned = VideoFramingGeometry.panned(
            framing: .identity,
            translation: CGSize(width: 250, height: -100),
            canvasSize: stage,
            snapping: false
        )
        #expect(panned.framing.x == 0.25)
        #expect(panned.framing.y == -0.1)
        #expect(panned.guides.isEmpty)
    }

    @Test func panningBackToTheMiddleSettlesThereAndSaysSo() {
        let start = VideoFraming(scale: 1.5, x: 0.2, y: 0.2)
        let panned = VideoFramingGeometry.panned(
            // 4pt short of centred on both axes, inside the 9pt pull.
            framing: start,
            translation: CGSize(width: -196, height: -196),
            canvasSize: stage
        )
        #expect(panned.framing.x == 0)
        #expect(panned.framing.y == 0)
        #expect(panned.framing.scale == 1.5)
        #expect(panned.guides.contains(CanvasGuide(axis: .vertical, position: 0.5)))
        #expect(panned.guides.contains(CanvasGuide(axis: .horizontal, position: 0.5)))
    }

    @Test func holdingTheBypassLeavesThePictureExactlyWhereThePointerPutIt() {
        let panned = VideoFramingGeometry.panned(
            framing: VideoFraming(scale: 1.5, x: 0.2, y: 0),
            translation: CGSize(width: -196, height: 0),
            canvasSize: stage,
            snapping: false
        )
        #expect(abs(panned.framing.x - 0.004) < 1e-9)
        #expect(panned.guides.isEmpty)
    }

    // MARK: - Zooming

    @Test func pullingACornerOutwardsZoomsIn() {
        let zoomed = VideoFramingGeometry.zoomed(
            framing: .identity,
            // Down and right from the bottom-right corner is outwards.
            translation: CGSize(width: 100, height: 100),
            corner: .bottomTrailing,
            canvasSize: stage
        )
        #expect(zoomed.scale > 1)
    }

    @Test func pushingACornerInwardsZoomsOut() {
        let zoomed = VideoFramingGeometry.zoomed(
            framing: VideoFraming(scale: 2, x: 0, y: 0),
            translation: CGSize(width: -100, height: -100),
            corner: .bottomTrailing,
            canvasSize: stage
        )
        #expect(zoomed.scale < 2)
    }

    @Test func everyCornerZoomsInWhenPulledAwayFromTheMiddle() {
        let corners: [(CanvasResizeCorner, CGSize)] = [
            (.topLeading, CGSize(width: -80, height: -80)),
            (.topTrailing, CGSize(width: 80, height: -80)),
            (.bottomLeading, CGSize(width: -80, height: 80)),
            (.bottomTrailing, CGSize(width: 80, height: 80)),
        ]
        for (corner, translation) in corners {
            let zoomed = VideoFramingGeometry.zoomed(
                framing: .identity,
                translation: translation,
                corner: corner,
                canvasSize: stage
            )
            #expect(zoomed.scale > 1, "\(corner) should have zoomed in")
        }
    }

    @Test func zoomingLeavesThePictureWhereItWasSlidTo() {
        let zoomed = VideoFramingGeometry.zoomed(
            framing: VideoFraming(scale: 1, x: 0.3, y: -0.2),
            translation: CGSize(width: 50, height: 50),
            corner: .bottomTrailing,
            canvasSize: stage
        )
        #expect(zoomed.x == 0.3)
        #expect(zoomed.y == -0.2)
    }

    @Test func aDragOfTheSameLengthZoomsTheSameAmountHoweverFarInYouAlreadyAre() {
        let fromFitted = VideoFramingGeometry.zoomed(
            framing: .identity,
            translation: CGSize(width: 60, height: 60),
            corner: .bottomTrailing,
            canvasSize: stage
        )
        let fromZoomed = VideoFramingGeometry.zoomed(
            framing: VideoFraming(scale: 3, x: 0, y: 0),
            translation: CGSize(width: 60, height: 60),
            corner: .bottomTrailing,
            canvasSize: stage
        )
        #expect(abs((fromFitted.scale - 1) - (fromZoomed.scale - 3)) < 1e-9)
    }

    // MARK: - Where the picture sits, which is where the handles go

    @Test func footageShapedLikeTheFrameFillsItExactly() {
        let box = VideoFramingGeometry.mediaBox(
            framing: .identity,
            sourceAspect: 1,
            stageSize: stage
        )
        #expect(box == CGRect(origin: .zero, size: stage))
    }

    @Test func landscapeFootageInASquareFrameIsLetterboxed() {
        let box = VideoFramingGeometry.mediaBox(
            framing: .identity,
            sourceAspect: 2,
            stageSize: stage
        )
        #expect(box.width == 1_000)
        #expect(box.height == 500)
        // Centred, which is what the letterbox looks like.
        #expect(box.midX == 500)
        #expect(box.midY == 500)
    }

    @Test func aZoomedPictureHangsOutsideTheFrame() {
        let box = VideoFramingGeometry.mediaBox(
            framing: VideoFraming(scale: 2, x: 0, y: 0),
            sourceAspect: 1,
            stageSize: stage
        )
        #expect(box.width == 2_000)
        // The corners are off the stage: reaching them is what the workspace
        // zoom is for, and drawing them outside the clip is what lets it work.
        #expect(box.minX == -500)
        #expect(box.maxX == 1_500)
        #expect(box.midY == 500)
    }

    @Test func slidingThePictureCarriesTheBoxWithIt() {
        let box = VideoFramingGeometry.mediaBox(
            framing: VideoFraming(scale: 1, x: 0.25, y: -0.1),
            sourceAspect: 1,
            stageSize: stage
        )
        #expect(box.midX == 750)
        #expect(box.midY == 400)
    }

    // MARK: - Carrying the picture while the composition catches up

    private static let previewStage = CGSize(width: 1200, height: 675)

    @Test func nothingIsPreviewedWhenTheCompositionAlreadyAgrees() {
        let framing = VideoFraming(scale: 1.5, x: 0.1, y: 0)
        #expect(
            VideoFramingGeometry.previewTransform(
                from: framing,
                to: framing,
                stageSize: Self.previewStage
            ) == nil
        )
    }

    @Test func thePreviewCarriesThePictureFromWhatIsRenderedToWhatIsWanted() {
        let rendered = VideoFraming(scale: 1.5, x: 0.2, y: -0.1)
        let wanted = VideoFraming(scale: 3, x: 0.4, y: 0.3)
        let stage = Self.previewStage
        let preview = try! #require(
            VideoFramingGeometry.previewTransform(from: rendered, to: wanted, stageSize: stage)
        )
        // Applying the preview to the picture already on screen has to land on
        // exactly the framing that was asked for, or the rebuild makes it jump.
        #expect(abs(rendered.scale * preview.scale - wanted.scale) < 1e-9)
        #expect(preview.rotation == 0)
        #expect(
            abs(
                rendered.x * stage.width * preview.scale + preview.offset.width
                    - wanted.x * stage.width
            ) < 1e-9
        )
        #expect(
            abs(
                rendered.y * stage.height * preview.scale + preview.offset.height
                    - wanted.y * stage.height
            ) < 1e-9
        )
    }

    /// The same guarantee once the picture is turned as well as zoomed: the
    /// three parts of the transform have to compose into exactly the framing
    /// that was asked for, or letting go of the rotate handle makes it jump.
    @Test func thePreviewCarriesAPictureThatIsAlsoTurned() {
        let rendered = VideoFraming(scale: 1.2, x: 0.15, y: -0.2, rotation: 10)
        let wanted = VideoFraming(scale: 1.8, x: -0.1, y: 0.25, rotation: 55)
        let stage = Self.previewStage
        let preview = try! #require(
            VideoFramingGeometry.previewTransform(from: rendered, to: wanted, stageSize: stage)
        )
        #expect(abs(preview.rotation - 45) < 1e-9)

        // Where the middle of the rendered picture ends up once the preview has
        // been applied: turned and scaled about the middle of the stage, then
        // slid. That has to be where the wanted framing puts it.
        let radians = preview.rotation * .pi / 180
        let carried = CGPoint(x: rendered.x * stage.width, y: rendered.y * stage.height)
        let landed = CGPoint(
            x: preview.scale * (cos(radians) * carried.x - sin(radians) * carried.y)
                + preview.offset.width,
            y: preview.scale * (sin(radians) * carried.x + cos(radians) * carried.y)
                + preview.offset.height
        )
        #expect(abs(landed.x - wanted.x * stage.width) < 1e-9)
        #expect(abs(landed.y - wanted.y * stage.height) < 1e-9)
    }

    // MARK: - Pulling the preview back

    @Test func thePreviewNeverGrowsPastTheFitOrShrinksToNothing() {
        #expect(PreviewZoom(scale: 4).isFit)
        #expect(PreviewZoom(scale: 0).scale == PreviewZoom.minimumScale)
        #expect(PreviewZoom.fit.isFit)
    }

    @Test func aPinchIsAppliedToWhereItStarted() {
        let start = PreviewZoom(scale: 0.8)
        #expect(abs(start.scaled(by: 0.5).scale - 0.4) < 1e-9)
        // And the same pinch twice from the same start is the same answer.
        #expect(start.scaled(by: 0.5) == start.scaled(by: 0.5))
    }

    // MARK: - Filling the frame

    @Test func landscapeFootageInAPortraitFrameNeedsTheRatioBetweenThem() {
        // 16:9 footage in a 9:16 frame: fitting scaled it down to a letterbox
        // of the frame's width, and covering needs (16/9) / (9/16) more.
        let scale = VideoFramingGeometry.fillingScale(
            sourceAspect: 16.0 / 9.0,
            frameAspect: 9.0 / 16.0
        )
        #expect(abs(scale - (16.0 / 9.0) / (9.0 / 16.0)) < 1e-9)
    }

    @Test func footageThatAlreadyMatchesTheFrameNeedsNoZoom() {
        let scale = VideoFramingGeometry.fillingScale(sourceAspect: 1.5, frameAspect: 1.5)
        #expect(scale == 1)
    }

    @Test func fillingWorksWhicheverWayRoundTheTwoShapesAre() {
        let portraitInLandscape = VideoFramingGeometry.fillingScale(
            sourceAspect: 9.0 / 16.0,
            frameAspect: 16.0 / 9.0
        )
        #expect(portraitInLandscape > 1)
    }

    // MARK: - The transform the export actually uses

    private let renderSize = CGSize(width: 1_080, height: 1_920)

    private func transform(_ framing: VideoFraming) -> CGAffineTransform {
        CompositionBuilder.fittedTransform(
            naturalSize: CGSize(width: 1_920, height: 1_080),
            preferredTransform: .identity,
            renderSize: renderSize,
            framing: framing
        )
    }

    @Test func fittedIsExactlyWhatItAlwaysWas() {
        #expect(transform(.identity) == transform(.identity))
        // 1920x1080 into 1080x1920 fits on width: scaled to 1080x607.5 and
        // centred, which is the letterbox framing exists to escape.
        let fitted = CGRect(x: 0, y: 0, width: 1_920, height: 1_080)
            .applying(transform(.identity))
        #expect(abs(fitted.width - 1_080) < 0.001)
        #expect(abs(fitted.midX - renderSize.width / 2) < 0.001)
        #expect(abs(fitted.midY - renderSize.height / 2) < 0.001)
    }

    @Test func zoomingGrowsThePictureAboutTheMiddleOfTheFrame() {
        let zoomed = CGRect(x: 0, y: 0, width: 1_920, height: 1_080)
            .applying(transform(VideoFraming(scale: 2, x: 0, y: 0)))
        #expect(abs(zoomed.width - 2_160) < 0.001)
        // Still centred: a zoom must not throw the shot off to one side.
        #expect(abs(zoomed.midX - renderSize.width / 2) < 0.001)
        #expect(abs(zoomed.midY - renderSize.height / 2) < 0.001)
    }

    @Test func aPositiveOffsetPushesThePictureRightAndDown() {
        let slid = CGRect(x: 0, y: 0, width: 1_920, height: 1_080)
            .applying(transform(VideoFraming(scale: 1, x: 0.25, y: 0.1)))
        let centred = CGRect(x: 0, y: 0, width: 1_920, height: 1_080)
            .applying(transform(.identity))
        #expect(abs(slid.midX - centred.midX - 0.25 * renderSize.width) < 0.001)
        #expect(abs(slid.midY - centred.midY - 0.1 * renderSize.height) < 0.001)
    }

    @Test func fillingTheFrameLeavesNoBars() {
        let scale = VideoFramingGeometry.fillingScale(
            sourceAspect: 1_920.0 / 1_080.0,
            frameAspect: 1_080.0 / 1_920.0
        )
        let filled = CGRect(x: 0, y: 0, width: 1_920, height: 1_080)
            .applying(transform(VideoFraming(scale: scale, x: 0, y: 0)))
        #expect(filled.width >= renderSize.width - 0.001)
        #expect(filled.height >= renderSize.height - 0.001)
    }
}
