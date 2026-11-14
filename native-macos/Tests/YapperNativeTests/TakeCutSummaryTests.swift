import Foundation
import Testing

@testable import YapperNative

/// The picture of what an edit kept: where the stretches fall and how much of
/// the footage is gone.
struct TakeCutSummaryTests {
    private func media(_ duration: Double) -> ProjectMedia {
        ProjectMedia(
            id: UUID(), url: URL(fileURLWithPath: "/tmp/take.mp4"), name: "take.mp4",
            duration: duration, width: 1080, height: 1920, hasAudio: true
        )
    }

    private func clip(_ media: ProjectMedia, _ start: Double, _ end: Double) -> TimelineClip {
        TimelineClip(mediaID: media.id, sourceStart: start, sourceEnd: end)
    }

    @Test func anUntouchedTakeIsNotCut() {
        let take = media(60)
        let summary = TakeCutSummary(clips: [clip(take, 0, 60)], media: [take])
        #expect(summary.sourceDuration == 60)
        #expect(summary.keptDuration == 60)
        #expect(!summary.isCut)
        #expect(summary.cutShare == 0)
    }

    @Test func keptStretchesAreFractionsOfTheTake() {
        let take = media(100)
        let summary = TakeCutSummary(clips: [clip(take, 10, 20), clip(take, 50, 75)], media: [take])
        #expect(summary.keptDuration == 35)
        #expect(summary.isCut)
        #expect(abs(summary.cutShare - 0.65) < 0.0001)
        #expect(summary.stretches == [.init(start: 0.1, end: 0.2), .init(start: 0.5, end: 0.75)])
    }

    @Test func twoFilesAreLaidEndToEnd() {
        let first = media(40)
        let second = media(60)
        let summary = TakeCutSummary(
            clips: [clip(first, 0, 20), clip(second, 30, 60)],
            media: [second, first]
        )
        #expect(summary.sourceDuration == 100)
        #expect(summary.stretches == [.init(start: 0, end: 0.2), .init(start: 0.7, end: 1)])
    }

    @Test func aClipPastTheEndOfItsFileIsClamped() {
        let take = media(10)
        let summary = TakeCutSummary(clips: [clip(take, 8, 30)], media: [take])
        #expect(summary.keptDuration == 2)
    }

    @Test func anEmptyTimelineHasNothingToShow() {
        let summary = TakeCutSummary(clips: [], media: [media(10)])
        #expect(summary.sourceDuration == 0)
        #expect(summary.stretches.isEmpty)
        #expect(!summary.isCut)
    }
}
