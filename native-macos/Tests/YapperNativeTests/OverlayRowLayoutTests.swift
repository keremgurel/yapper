import CoreGraphics
import Foundation
import Testing

@testable import YapperNative

/// A row of icons is one decision, not several. These pin down the two things a
/// creator would notice immediately if they were wrong: that the icons are the
/// same size and on the same line, and that the row as a whole stays off the
/// speaker's face.
struct OverlayRowLayoutTests {
    private let portrait = 9.0 / 16.0
    /// A square icon and a wide wordmark: the case equal widths would get wrong.
    private let square = 1.0
    private let wide = 2.0

    private var speaker: [SpeakerRegion] {
        SpeakerRegions.avoid(faces: [CGRect(x: 0.32, y: 0.34, width: 0.36, height: 0.24)])
    }

    private func close(_ a: Double, _ b: Double) -> Bool { abs(a - b) < 0.0005 }

    private func solve(
        _ shapes: [Double],
        width: Double? = nil,
        origin: (x: Double, y: Double)? = nil,
        avoid: [SpeakerRegion] = []
    ) -> [OverlayBox] {
        OverlayRowLayout.solve(
            members: shapes.map { .init(mediaAspect: $0) },
            proposedWidth: width,
            proposedOrigin: origin,
            frameAspect: portrait,
            avoid: avoid
        )
    }

    @Test func everySlotComesBackTheSameHeightOnTheSameLine() {
        let boxes = solve([square, wide, square])
        #expect(boxes.count == 3)
        for box in boxes.dropFirst() {
            #expect(close(box.y, boxes[0].y))
            #expect(close(box.height, boxes[0].height))
        }
        // Equal height, not equal width: a wordmark twice as wide as a square
        // icon comes back twice as wide.
        #expect(close(boxes[1].width, boxes[0].width * 2))
        #expect(close(boxes[2].width, boxes[0].width))
    }

    @Test func slotsRunLeftToRightWithAnEvenGap() {
        let boxes = solve([square, square, square])
        #expect(boxes[0].x < boxes[1].x)
        #expect(boxes[1].x < boxes[2].x)
        let firstGap = boxes[1].x - (boxes[0].x + boxes[0].width)
        let secondGap = boxes[2].x - (boxes[1].x + boxes[1].width)
        #expect(close(firstGap, secondGap))
        #expect(firstGap > 0)
    }

    @Test func theRowAddsUpToTheWidthItWasAskedFor() {
        let boxes = solve([square, wide], width: 0.6)
        let span = (boxes.last?.x ?? 0) + (boxes.last?.width ?? 0) - (boxes.first?.x ?? 0)
        #expect(close(span, 0.6))
    }

    @Test func aRowStaysOffTheFace() {
        let boxes = solve([square, square], width: 0.6, origin: (x: 0.2, y: 0.36), avoid: speaker)
        guard let face = speaker.first else { return }
        for box in boxes {
            let rect = CGRect(x: box.x, y: box.y, width: box.width, height: box.height)
            let hit = rect.intersection(face.rect)
            #expect(hit.isNull || hit.width * hit.height < 0.0001)
        }
    }

    /// The row is solved as one box, so if it has to shrink to clear a face it
    /// shrinks together. Slots drifting apart is what stops it being a row.
    @Test func shrinkingTheRowScalesEverySlotTogether() {
        let crowded = SpeakerRegions.avoid(
            faces: [CGRect(x: 0.02, y: 0.02, width: 0.96, height: 0.94)]
        )
        let boxes = solve([square, wide], width: 0.7, origin: (x: 0.15, y: 0.3), avoid: crowded)
        #expect(boxes.count == 2)
        #expect(close(boxes[1].width / boxes[0].width, 2))
        #expect(close(boxes[1].y, boxes[0].y))
        for box in boxes {
            #expect(box.x >= 0)
            #expect(box.x + box.width <= 1.0001)
        }
    }

    @Test func everySlotStaysOnTheFrame() {
        for count in 1 ... 5 {
            let boxes = solve(Array(repeating: square, count: count), width: 0.9)
            #expect(boxes.count == count)
            for box in boxes {
                #expect(box.x >= -0.0001)
                #expect(box.y >= -0.0001)
                #expect(box.x + box.width <= 1.0001)
                #expect(box.y + box.height <= 1.0001)
            }
        }
    }

    @Test func aRowOfOneIsJustAnOverlay() {
        let row = solve([wide], width: 0.5, origin: (x: 0.05, y: 0.04))
        let alone = OverlayLayout.solve(
            proposed: ProposedOverlayBox(x: 0.05, y: 0.04, width: 0.5),
            mediaAspect: wide,
            frameAspect: portrait,
            avoid: []
        )
        #expect(row.count == 1)
        #expect(close(row[0].x, alone.x))
        #expect(close(row[0].y, alone.y))
        #expect(close(row[0].width, alone.width))
        #expect(close(row[0].height, alone.height))
    }

    @Test func nothingToLayOutComesBackEmpty() {
        #expect(solve([]).isEmpty)
    }

    /// Five icons at the default width would each be tiny. The height ends up
    /// small, but every slot is still on the frame and still the same size,
    /// which is the contract the row promises.
    @Test func aLongRowStillDividesEvenly() {
        let boxes = solve(Array(repeating: square, count: 5), width: 0.85)
        let widths = Set(boxes.map { ($0.width * 10000).rounded() })
        #expect(widths.count == 1)
    }
}
