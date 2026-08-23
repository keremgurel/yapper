import CoreGraphics
import Testing
@testable import YapperNative

struct TranscriptLineBreakerTests {
    @Test func tokensFillALineBeforeWrapping() {
        let lines = TranscriptLineBreaker.lines(
            widths: [40, 40, 40],
            spacing: 5,
            available: 100
        )
        // 40 + 5 + 40 = 85 fits; adding the third would reach 130.
        #expect(lines.count == 2)
        #expect(lines[0].tokens == [0, 1])
        #expect(lines[0].offsets == [0, 45])
        #expect(lines[1].tokens == [2])
    }

    @Test func aTokenWiderThanTheLineGetsItsOwn() {
        let lines = TranscriptLineBreaker.lines(
            widths: [30, 500, 30],
            spacing: 5,
            available: 100
        )
        #expect(lines.map(\.tokens) == [[0], [1], [2]])
    }

    @Test func lineWidthExcludesTheTrailingGap() {
        let lines = TranscriptLineBreaker.lines(widths: [20, 20], spacing: 5, available: 100)
        #expect(lines.count == 1)
        #expect(lines[0].width == 45)
    }

    @Test func nothingInNothingOut() {
        #expect(TranscriptLineBreaker.lines(widths: [], spacing: 5, available: 100).isEmpty)
        // A width of zero must not spin or divide by it.
        #expect(TranscriptLineBreaker.lines(widths: [10], spacing: 5, available: 0).count == 1)
    }

    @Test func aTokenKnowsWhereItIsInTheWholeFlow() {
        let widths = [40.0, 40, 40]
        let lines = TranscriptLineBreaker.lines(widths: widths, spacing: 5, available: 100)
        let second = TranscriptLineBreaker.frame(
            ofToken: 2,
            in: lines,
            widths: widths,
            lineHeight: 20,
            lineSpacing: 6
        )
        #expect(second == CGRect(x: 0, y: 26, width: 40, height: 20))
        #expect(TranscriptLineBreaker.frame(
            ofToken: 99, in: lines, widths: widths, lineHeight: 20, lineSpacing: 6
        ) == nil)
    }

    @Test func aLineHitTestsTokensWithoutGivingTheGapsAnAction() throws {
        let widths = [40.0, 30, 20]
        let line = try #require(
            TranscriptLineBreaker.lines(widths: widths, spacing: 5, available: 200).first
        )
        #expect(TranscriptLineBreaker.token(atX: 0, in: line, widths: widths) == 0)
        #expect(TranscriptLineBreaker.token(atX: 39, in: line, widths: widths) == 0)
        #expect(TranscriptLineBreaker.token(atX: 42, in: line, widths: widths) == nil)
        #expect(TranscriptLineBreaker.token(atX: 45, in: line, widths: widths) == 1)
        #expect(TranscriptLineBreaker.token(atX: 79, in: line, widths: widths) == nil)
        #expect(TranscriptLineBreaker.token(atX: 80, in: line, widths: widths) == 2)
        #expect(TranscriptLineBreaker.token(atX: -1, in: line, widths: widths) == nil)
        #expect(TranscriptLineBreaker.token(atX: 101, in: line, widths: widths) == nil)
    }
}
