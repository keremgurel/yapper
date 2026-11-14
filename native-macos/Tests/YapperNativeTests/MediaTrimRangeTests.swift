import Foundation
import Testing

@testable import YapperNative

/// Choosing the part of a file to add. The two ends can never cross, leave the
/// file, or close up to nothing.
struct MediaTrimRangeTests {
    @Test func startsAsTheWholeFile() {
        let range = MediaTrimRange(duration: 30)
        #expect(range.start == 0)
        #expect(range.end == 30)
        #expect(range.isFull)
    }

    @Test func movingAnEndTrimsIt() {
        let range = MediaTrimRange(duration: 30).movingStart(to: 4).movingEnd(to: 12.5)
        #expect(range.start == 4)
        #expect(range.end == 12.5)
        #expect(range.length == 8.5)
        #expect(!range.isFull)
    }

    @Test func theStartStopsShortOfTheEnd() {
        let range = MediaTrimRange(duration: 30).movingEnd(to: 10).movingStart(to: 25)
        #expect(range.start == 10 - MediaTrimRange.minimumLength)
    }

    @Test func theEndStopsShortOfTheStart() {
        let range = MediaTrimRange(duration: 30).movingStart(to: 10).movingEnd(to: 2)
        #expect(range.end == 10 + MediaTrimRange.minimumLength)
    }

    @Test func neitherEndLeavesTheFile() {
        let range = MediaTrimRange(duration: 30).movingStart(to: -5).movingEnd(to: 90)
        #expect(range.isFull)
    }

    @Test func aFileShorterThanTheMinimumStaysWhole() {
        let range = MediaTrimRange(duration: 0.1).movingStart(to: 0.05).movingEnd(to: 0.01)
        #expect(range.start == 0)
        #expect(range.end == 0.1)
    }

    @Test func aBrokenLengthIsAnEmptyRange() {
        #expect(MediaTrimRange(duration: .nan).length == 0)
    }

    @Test func timesReadToTheTenth() {
        #expect(MediaTrimTime.text(4.24) == "0:04.2")
        #expect(MediaTrimTime.text(125.96) == "2:06.0")
        #expect(MediaTrimTime.length(26.84) == "26.8s")
        #expect(MediaTrimTime.length(75) == "1:15.0")
    }
}
