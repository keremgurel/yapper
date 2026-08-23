import AVFoundation
import CoreGraphics
import CoreImage
import Foundation
import Testing

@testable import YapperNative

/// Turning things: the speaker's own picture, a cutaway laid over it, and the
/// cards of words on top of both.
///
/// The angle has to mean the same thing everywhere it is drawn, and it is drawn
/// in three different coordinate systems: the canvas measures from the top left,
/// AVFoundation's compositor does too, and Core Animation measures from the
/// bottom. Clockwise on screen is the one answer all three have to agree on.
struct RotationTests {
    // MARK: - The value

    @Test("A turn past half way round is read as a turn the other way")
    func rotationWraps() {
        // Otherwise a rotate handle dragged in circles banks up a number that
        // reads as nonsense, and 190° and -170° are the same picture.
        #expect(VideoFraming(scale: 1, x: 0, y: 0, rotation: 190).rotation == -170)
        #expect(VideoFraming(scale: 1, x: 0, y: 0, rotation: -190).rotation == 170)
        #expect(VideoFraming(scale: 1, x: 0, y: 0, rotation: 720).rotation == 0)
        #expect(VideoFraming(scale: 1, x: 0, y: 0, rotation: 180).rotation == 180)
    }

    @Test("An upright framing is still the identity")
    func uprightIsIdentity() {
        #expect(VideoFraming(scale: 1, x: 0, y: 0, rotation: 0).isIdentity)
        #expect(!VideoFraming(scale: 1, x: 0, y: 0, rotation: 12).isIdentity)
    }

    @Test("A project saved before rotation existed reads back upright")
    func oldProjectsDecodeUpright() throws {
        let json = Data(#"{"scale":1.4,"x":0.1,"y":-0.2}"#.utf8)
        let framing = try JSONDecoder().decode(VideoFraming.self, from: json)
        #expect(framing.rotation == 0)
        #expect(framing.scale == 1.4)
    }

    @Test("An angle survives being saved and opened again")
    func rotationRoundTrips() throws {
        let framing = VideoFraming(scale: 1.2, x: 0, y: 0.1, rotation: -35)
        let data = try JSONEncoder().encode(framing)
        #expect(try JSONDecoder().decode(VideoFraming.self, from: data) == framing)
    }

    @Test("Only the part of a framing that was asked for changes")
    func withChangesOneThing() {
        let framing = VideoFraming(scale: 1.5, x: 0.2, y: -0.1, rotation: 20)
        #expect(framing.with(scale: 2) == VideoFraming(scale: 2, x: 0.2, y: -0.1, rotation: 20))
        #expect(framing.with(rotation: 0) == VideoFraming(scale: 1.5, x: 0.2, y: -0.1))
    }

    // MARK: - The composition

    @Test("The composition turns the picture clockwise")
    func compositionTurnsClockwise() {
        // A square picture in a square frame, turned a quarter of the way round.
        // The middle of the right edge has to end up at the middle of the bottom
        // one, which is what clockwise means when the frame is measured from its
        // top left corner.
        let size = CGSize(width: 1000, height: 1000)
        let transform = CompositionBuilder.fittedTransform(
            naturalSize: size,
            preferredTransform: .identity,
            renderSize: size,
            framing: VideoFraming(scale: 1, x: 0, y: 0, rotation: 90)
        )
        let landed = CGPoint(x: 1000, y: 500).applying(transform)
        #expect(abs(landed.x - 500) < 0.001)
        #expect(abs(landed.y - 1000) < 0.001)
    }

    @Test("Turning the picture never moves its middle")
    func turningKeepsTheCentre() {
        let size = CGSize(width: 1000, height: 1000)
        let framing = VideoFraming(scale: 1.4, x: 0.1, y: -0.2, rotation: 37)
        let upright = CompositionBuilder.fittedTransform(
            naturalSize: size,
            preferredTransform: .identity,
            renderSize: size,
            framing: framing.with(rotation: 0)
        )
        let turned = CompositionBuilder.fittedTransform(
            naturalSize: size,
            preferredTransform: .identity,
            renderSize: size,
            framing: framing
        )
        let middle = CGPoint(x: 500, y: 500)
        #expect(abs(middle.applying(upright).x - middle.applying(turned).x) < 0.001)
        #expect(abs(middle.applying(upright).y - middle.applying(turned).y) < 0.001)
    }

    @Test("A cutaway turns about the middle of its own card")
    func cutawayTurnsAboutItsCard() {
        let box = CGRect(x: 200, y: 100, width: 400, height: 300)
        let transform = CompositionBuilder.overlayTransform(
            naturalSize: CGSize(width: 400, height: 300),
            preferredTransform: .identity,
            crop: .full,
            box: box,
            rotation: 90
        )
        // The card's middle stays put and its top left corner swings round to
        // where its top right was.
        let middle = CGPoint(x: 200, y: 150).applying(transform)
        #expect(abs(middle.x - box.midX) < 0.001)
        #expect(abs(middle.y - box.midY) < 0.001)
        let corner = CGPoint(x: 0, y: 0).applying(transform)
        #expect(abs(corner.x - (box.midX + box.height / 2)) < 0.001)
        #expect(abs(corner.y - (box.midY - box.width / 2)) < 0.001)
    }

    @Test("A turned card still has its corners taken off")
    func aTurnedCardIsRoundedRoundItself() {
        // The rounding is a mask, and a mask is square to the frame. A card
        // standing at an angle fills only the middle of the square it sits in,
        // so rounding it where it lies took the corners off that square and
        // left the card itself sharp.
        let side = 200.0
        let solid = CIImage(color: CIColor(red: 1, green: 0, blue: 0))
            .cropped(to: CGRect(x: 0, y: 0, width: side, height: side))
        let centre = CGPoint(x: side / 2, y: side / 2)
        let turned = solid.transformed(
            by: CGAffineTransform(translationX: -centre.x, y: -centre.y)
                .concatenating(CGAffineTransform(rotationAngle: .pi / 4))
                .concatenating(CGAffineTransform(translationX: centre.x, y: centre.y))
        )
        let style = OverlayCardStyle(
            cornerRadius: 40,
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: 0
        )
        let drawn = OverlayCard.drawn(
            turned,
            style: style,
            // The card itself, which is not the square its turned image fills.
            box: CGRect(x: 0, y: 0, width: side, height: side),
            turnedBy: -45
        )

        // A point just inside one of the diamond's four tips, which is a corner
        // of the card itself. Rounding has to have taken it away.
        let reach = side / 2 * 2.0.squareRoot()
        let tip = CGPoint(x: centre.x, y: centre.y + reach - 6)
        #expect(alpha(of: drawn, at: tip) < 0.1)
        // And the middle of the card is untouched.
        #expect(alpha(of: drawn, at: centre) > 0.9)
    }

    /// How opaque a rendered image is at one point, as the compositor would see
    /// it once the card has been drawn.
    private func alpha(of image: CIImage, at point: CGPoint) -> Double {
        var pixel = [UInt8](repeating: 0, count: 4)
        CIContext(options: [.workingColorSpace: NSNull()]).render(
            image,
            toBitmap: &pixel,
            rowBytes: 4,
            bounds: CGRect(x: point.x, y: point.y, width: 1, height: 1),
            format: .RGBA8,
            colorSpace: nil
        )
        return Double(pixel[3]) / 255
    }

    // MARK: - Filling a frame that has been turned

    @Test("A turned picture needs a bigger zoom to leave no bars")
    func fillingATurnedFrameNeedsMoreZoom() {
        // Landscape footage in a portrait frame, which is the case the button
        // exists for. Once it is on its side it has to be zoomed further still
        // or the corners of the frame show through.
        let upright = VideoFramingGeometry.fillingScale(sourceAspect: 16.0 / 9, frameAspect: 9.0 / 16)
        let sideways = VideoFramingGeometry.fillingScale(
            sourceAspect: 16.0 / 9,
            frameAspect: 9.0 / 16,
            rotation: 90
        )
        #expect(sideways < upright)
        #expect(sideways > 0)
    }

    @Test("A square picture in a square frame still needs no zoom to fill it")
    func squareInSquareNeedsNothing() {
        #expect(abs(VideoFramingGeometry.fillingScale(sourceAspect: 1, frameAspect: 1) - 1) < 1e-9)
    }

    // MARK: - The gestures

    @Test("The rotate handle measures the angle it has swept")
    func theHandleSweepsAnAngle() {
        let centre = CGPoint(x: 100, y: 100)
        let turned = VideoFramingGeometry.rotated(
            framing: .identity,
            centre: centre,
            // Straight up, then straight out to the right: a quarter turn.
            from: CGPoint(x: 100, y: 20),
            to: CGPoint(x: 180, y: 100),
            snapping: false
        )
        #expect(abs(turned.rotation - 90) < 1e-9)
    }

    @Test("A turn that lands near a quarter settles on it")
    func theHandleSnapsToQuarterTurns() {
        let centre = CGPoint(x: 100, y: 100)
        let nearly = VideoFramingGeometry.rotated(
            framing: .identity,
            centre: centre,
            from: CGPoint(x: 100, y: 20),
            to: CGPoint(x: 179, y: 96),
            snapping: true
        )
        #expect(nearly.rotation == 90)
    }

    @Test("Option holds the angle wherever the pointer put it")
    func snappingCanBeBypassed() {
        let centre = CGPoint(x: 100, y: 100)
        let free = VideoFramingGeometry.rotated(
            framing: .identity,
            centre: centre,
            from: CGPoint(x: 100, y: 20),
            to: CGPoint(x: 179, y: 96),
            snapping: false
        )
        #expect(free.rotation != 90)
    }

    @Test("Pulling a corner of a turned picture still grows it")
    func zoomingATurnedPicture() {
        // A quarter turn clockwise puts the picture's own right edge along the
        // bottom of the screen, so its bottom right corner is now at the bottom
        // left and the drag that pulls it outwards points down the screen.
        // Measured along the screen's own axes that drag would have shrunk it.
        let sideways = VideoFraming(scale: 1, x: 0, y: 0, rotation: 90)
        let outwards = VideoFramingGeometry.zoomed(
            framing: sideways,
            translation: CGSize(width: 0, height: 120),
            corner: .bottomTrailing,
            canvasSize: CGSize(width: 600, height: 400)
        )
        #expect(outwards.scale > 1)

        // Across the screen is towards the middle of a picture lying on its
        // side, which is the drag that shrinks it.
        let inwards = VideoFramingGeometry.zoomed(
            framing: sideways,
            translation: CGSize(width: 120, height: 0),
            corner: .bottomTrailing,
            canvasSize: CGSize(width: 600, height: 400)
        )
        #expect(inwards.scale < 1)
    }

    // MARK: - Settling the picture against the frame

    @Test("A zoomed-in picture settles flush with the top of the frame")
    func theTopEdgeSnaps() {
        // The case this exists for: a clip punched into so the speaker fills
        // more of the shot, slid up until no black shows above their head.
        // Lining that up by eye is a pixel hunt.
        let stage = CGSize(width: 600, height: 600)
        // Square footage in a square frame at 150%, so the picture is 900
        // points tall and its top edge is 150 above the frame's.
        let framing = VideoFraming(scale: 1.5, x: 0, y: 0)
        let slid = VideoFramingGeometry.panned(
            framing: framing,
            // Nearly, but not quite, flush.
            translation: CGSize(width: 0, height: 145),
            canvasSize: stage,
            sourceAspect: 1
        )
        let box = VideoFramingGeometry.mediaBox(
            framing: slid.framing,
            sourceAspect: 1,
            stageSize: stage
        )
        #expect(abs(box.minY) < 0.001)
        #expect(slid.guides.contains(CanvasGuide(axis: .horizontal, position: 0)))
    }

    @Test("The middle still settles on the middle")
    func theCentreStillSnaps() {
        let stage = CGSize(width: 600, height: 600)
        let slid = VideoFramingGeometry.panned(
            framing: VideoFraming(scale: 1.5, x: 0.2, y: 0),
            translation: CGSize(width: -119, height: 0),
            canvasSize: stage,
            sourceAspect: 1
        )
        #expect(slid.framing.x == 0)
        #expect(slid.guides.contains(CanvasGuide(axis: .vertical, position: 0.5)))
    }

    @Test("Option drops the picture where the pointer put it")
    func panSnappingCanBeBypassed() {
        let stage = CGSize(width: 600, height: 600)
        let slid = VideoFramingGeometry.panned(
            framing: VideoFraming(scale: 1.5, x: 0.2, y: 0),
            translation: CGSize(width: -119, height: 0),
            canvasSize: stage,
            sourceAspect: 1,
            snapping: false
        )
        #expect(slid.framing.x != 0)
        #expect(slid.guides.isEmpty)
    }

    @Test("A picture nowhere near a line is left where it was dropped")
    func nothingSnapsFromFarAway() {
        let stage = CGSize(width: 600, height: 600)
        let slid = VideoFramingGeometry.panned(
            framing: VideoFraming(scale: 1.5, x: 0, y: 0),
            // Away from a line on both axes: leaving one of them where it
            // started would settle it on the middle, which is a line.
            translation: CGSize(width: 70, height: 70),
            canvasSize: stage,
            sourceAspect: 1
        )
        #expect(abs(slid.framing.x - 70.0 / 600) < 1e-9)
        #expect(abs(slid.framing.y - 70.0 / 600) < 1e-9)
        #expect(slid.guides.isEmpty)
    }

    // MARK: - Overlays

    @Test("An overlay saved before rotation existed is upright")
    func overlaysDefaultToUpright() {
        let overlay = ProjectOverlay(mediaID: UUID(), timelineStart: 0, duration: 3)
        #expect(overlay.resolvedRotation == 0)
        #expect(overlay.rotationRadians == 0)
    }

    @Test("Turning a card is a change the player can be re-dressed for")
    func overlayRotationIsPresentationOnly() {
        // Which is what keeps the preview from tearing the whole playback
        // pipeline down and seeking back for a change that moved no track.
        let media = ProjectMedia(
            url: URL(fileURLWithPath: "/tmp/clip.mov"),
            name: "clip.mov",
            duration: 10,
            width: 1920,
            height: 1080,
            hasAudio: true
        )
        let overlay = ProjectOverlay(mediaID: media.id, timelineStart: 1, duration: 3)
        let project = EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 10)],
            overlays: [overlay]
        )
        var turned = project
        turned.overlays?[0].rotation = 15
        #expect(turned.differsOnlyInPresentation(from: project))
    }

    @Test("A card copied onto another takes its angle with it")
    func cutawayLookCarriesTheAngle() {
        var source = ProjectOverlay(mediaID: UUID(), timelineStart: 0, duration: 3)
        source.rotation = -12
        let target = ProjectOverlay(mediaID: UUID(), timelineStart: 4, duration: 2)
        #expect(CutawayLook.of(source).applied(to: target).resolvedRotation == -12)
    }

    // MARK: - Words

    @Test("A caption card carries an angle like every other property")
    func captionStyleCarriesRotation() {
        var style = TextStyle()
        style.apply(TextStylePatch(rotation: 300))
        // Clamped the same way the picture's is, so the canvas and the number
        // field can never disagree about what the card is set to.
        #expect(style.rotation == -60)
    }

    @Test("One card's angle can override the shared one")
    func captionRotationOverrides() {
        let caption = ProjectCaption(
            mediaID: UUID(),
            text: "Hello",
            sourceStart: 0,
            sourceEnd: 1,
            overrides: TextStylePatch(rotation: 8)
        )
        var shared = TextStyle()
        shared.rotation = -3
        #expect(caption.resolvedStyle(base: shared).rotation == 8)
    }

    @Test("A text layer keeps its angle through the style bridge")
    func textLayerRotationSurvivesAPatch() {
        var layer = ProjectTextLayer(text: "Hook", timelineStart: 0)
        layer.apply(TextStylePatch(rotation: 25))
        #expect(layer.rotation == 25)
        // A patch about something else leaves it alone.
        layer.apply(TextStylePatch(width: 0.5))
        #expect(layer.rotation == 25)
    }

    @Test("A text layer saved before rotation existed reads back upright")
    func oldTextLayersDecodeUpright() throws {
        let json = Data(
            #"{"id":"00000000-0000-0000-0000-000000000001","text":"Hi","timelineStart":0,"duration":4,"x":0.5,"y":0.2,"width":0.7,"appearance":null}"#
                .utf8
        )
        let layer = try JSONDecoder().decode(ProjectTextLayer.self, from: json)
        #expect(layer.rotation == 0)
    }
}
