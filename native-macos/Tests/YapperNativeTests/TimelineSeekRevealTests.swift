import Foundation
import Testing
@testable import YapperNative

@MainActor
struct TimelineSeekRevealTests {
    private func project() -> EditorProject {
        let mediaID = UUID()
        var project = EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(filePath: "/tmp/seek-reveal.mov"),
                    name: "seek-reveal",
                    duration: 10,
                    width: 1_920,
                    height: 1_080,
                    hasAudio: true
                ),
            ],
            clips: [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 10)],
            transcript: [1.0, 2.0, 5.0, 6.0].enumerated().map { index, start in
                TranscriptWord(
                    mediaID: mediaID,
                    text: "word\(index)",
                    start: start,
                    end: start + 0.25
                )
            },
            captionsEnabled: true,
            captionWordsPerCard: 2
        )
        project.regenerateCaptions()
        return project
    }

    @Test func repeatedSeeksRemainDistinctOneShotRequests() throws {
        let state = TimelineSeekRevealState()
        state.reveal(at: 4.2)
        let first = try #require(state.request)
        state.reveal(at: 4.2)
        let second = try #require(state.request)

        #expect(second.sequence == first.sequence + 1)
        #expect(second.timelineTime == 4.2)
    }

    @Test func transcriptLookupFindsTheNearestWordAndItsLazyRow() throws {
        let project = project()
        let cache = TranscriptFlowCache()
        cache.refresh(for: project)
        let words = try #require(project.transcript)

        #expect(cache.nearestWordID(to: 0) == words[0].id)
        #expect(cache.nearestWordID(to: 5.1) == words[2].id)
        #expect(cache.lineID(forWordID: words[2].id, width: 90) != nil)
    }

    @Test func captionLookupChecksOnlyTheNeighboursAroundASeek() throws {
        let project = project()
        let cache = CaptionCueCache()
        cache.refresh(for: project)
        let last = try #require(cache.cues.last)

        #expect(cache.nearestCueID(to: last.timelineStart) == last.id)
        #expect(cache.nearestCueID(to: 100) == last.id)
    }
}
