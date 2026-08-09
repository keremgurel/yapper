import CoreGraphics
import Foundation
import Testing

@testable import YapperNative

/// Face rectangles arrive in the source picture's own space and have to end up
/// in the rendered frame's, because that is the only space an overlay's box is
/// ever measured in. The main track is fitted rather than filled, so the two
/// only agree when the project's shape agrees with the footage's.
struct SpeakerRegionTests {
    private let portrait = 9.0 / 16.0
    private let landscape = 16.0 / 9.0

    private func close(_ a: Double, _ b: Double) -> Bool { abs(a - b) < 0.0005 }

    private func close(_ a: CGRect, _ b: CGRect) -> Bool {
        close(a.minX, b.minX) && close(a.minY, b.minY)
            && close(a.width, b.width) && close(a.height, b.height)
    }

    @Test func footageShotForTheFrameIsLeftWhereItIs() {
        let face = CGRect(x: 0.34, y: 0.2, width: 0.3, height: 0.22)
        let mapped = SpeakerRegions.inFrame(
            face,
            sourceAspect: portrait,
            frameAspect: portrait
        )
        #expect(close(mapped, face))
    }

    @Test func wideFootageInATallFrameLandsInTheBand() {
        // 16:9 fitted into 9:16 spans the full width and takes 0.3164 of the
        // height, sitting centred, so the picture starts 0.3418 down.
        let mapped = SpeakerRegions.inFrame(
            CGRect(x: 0.4, y: 0, width: 0.2, height: 1),
            sourceAspect: landscape,
            frameAspect: portrait
        )
        #expect(close(mapped.minX, 0.4))
        #expect(close(mapped.width, 0.2))
        #expect(close(mapped.minY, 0.341797))
        #expect(close(mapped.height, 0.316406))
    }

    @Test func tallFootageInAWideFrameIsPillarboxed() {
        let mapped = SpeakerRegions.inFrame(
            CGRect(x: 0, y: 0.4, width: 1, height: 0.2),
            sourceAspect: portrait,
            frameAspect: landscape
        )
        // The height is untouched; the width shrinks and centres.
        #expect(close(mapped.minY, 0.4))
        #expect(close(mapped.height, 0.2))
        #expect(close(mapped.width, portrait / landscape))
        #expect(close(mapped.minX, (1 - portrait / landscape) / 2))
    }

    @Test func everywhereTheSpeakerWasBecomesOneBox() {
        let union = SpeakerRegions.union([
            CGRect(x: 0.3, y: 0.2, width: 0.2, height: 0.2),
            CGRect(x: 0.4, y: 0.25, width: 0.2, height: 0.2),
        ])
        #expect(close(union ?? .zero, CGRect(x: 0.3, y: 0.2, width: 0.3, height: 0.25)))
        #expect(SpeakerRegions.union([]) == nil)
    }

    @Test func aFaceBecomesAPaddedFaceAndTheShouldersBelowIt() {
        let regions = SpeakerRegions.avoid(
            faces: [CGRect(x: 0.35, y: 0.2, width: 0.3, height: 0.2)]
        )
        #expect(regions.count == 2)

        let face = regions[0]
        #expect(face.weight == SpeakerRegions.faceWeight)
        // Vision finds the features, not the hair or the chin.
        #expect(close(face.rect.minY, 0.2 - SpeakerRegions.topPadding))
        #expect(close(face.rect.minX, 0.35 - SpeakerRegions.sidePadding))

        let torso = regions[1]
        #expect(torso.weight == SpeakerRegions.torsoWeight)
        #expect(close(torso.rect.minY, face.rect.maxY))
        #expect(close(torso.rect.width, face.rect.width))
        // Shoulders, not the whole body. The bottom of the frame stays free,
        // because it is usually the best place a card can go.
        #expect(close(torso.rect.height, 0.2))
        #expect(torso.rect.maxY < 1)
        // And it is a preference, not a rule: a card has to be allowed to sit
        // on a shoulder when the frame leaves it nowhere else.
        #expect(torso.weight < face.weight)
    }

    @Test func aFaceAgainstAnEdgeStaysInsideTheFrame() {
        let regions = SpeakerRegions.avoid(
            faces: [CGRect(x: 0, y: 0, width: 0.3, height: 0.2)]
        )
        let face = regions[0].rect
        #expect(face.minX == 0)
        #expect(face.minY == 0)
        #expect(face.maxX <= 1)
        #expect(face.maxY <= 1)
    }

    @Test func nothingSeenMeansNothingToAvoid() {
        #expect(SpeakerRegions.avoid(faces: []).isEmpty)
        #expect(SpeakerRegions.avoid(faces: [.zero]).isEmpty)
    }

    /// A face that runs to the bottom of the frame leaves no shoulders below
    /// it, and an empty region would still be scored against every candidate.
    @Test func aFaceRunningToTheBottomGrowsNoShoulders() {
        let regions = SpeakerRegions.avoid(
            faces: [CGRect(x: 0.2, y: 0.6, width: 0.5, height: 0.4)]
        )
        #expect(regions.count == 1)
    }
}
