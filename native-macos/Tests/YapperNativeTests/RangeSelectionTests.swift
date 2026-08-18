import Foundation
import Testing

@testable import YapperNative

/// Shift-click reaches back to the last thing clicked and takes everything
/// between it and this one, the way a list behaves everywhere else.
@MainActor
@Suite struct RangeSelectionTests {
    private let mediaID = UUID()

    private func session() async -> EditorSession {
        let session = EditorSession(store: QuietRangeStore())
        for _ in 0 ..< 500 where session.isBusy { await Task.yield() }
        session.updateProject { project in
            project.media = [ProjectMedia(
                id: self.mediaID,
                url: URL(filePath: "/tmp/range.mov"),
                name: "range.mov",
                duration: 8,
                width: 160,
                height: 90,
                hasAudio: false
            )]
            project.clips = [TimelineClip(mediaID: self.mediaID, sourceStart: 0, sourceEnd: 4)]
            project.transcript = (0 ..< 5).map { index in
                TranscriptWord(
                    mediaID: self.mediaID,
                    text: "word\(index)",
                    start: Double(index) * 0.5 + 0.1,
                    end: Double(index) * 0.5 + 0.3
                )
            }
            project.captionWordsPerCard = 1
            project.regenerateCaptions()
            project.overlays = (0 ..< 4).map { index in
                ProjectOverlay(
                    mediaID: self.mediaID,
                    timelineStart: Double(index),
                    duration: 0.5
                )
            }
        }
        return session
    }

    @Test func shiftClickTakesEveryCaptionBetween() async {
        let session = await session()
        let cues = session.captionCues
        #expect(cues.count == 5)

        session.selectTimelineItem(.caption(cues[1].id))
        session.selectTimelineItem(.caption(cues[3].id), ranging: true)

        #expect(session.timelineSelection == Set(cues[1 ... 3].map { .caption($0.id) }))
        // And the panel hears about all of them.
        #expect(session.selectedCaptionIDs == Set(cues[1 ... 3].map(\.id)))
    }

    @Test func aRunReadsBackwardsToo() async {
        let session = await session()
        let cues = session.captionCues

        session.selectTimelineItem(.caption(cues[4].id))
        session.selectTimelineItem(.caption(cues[2].id), ranging: true)

        #expect(session.timelineSelection == Set(cues[2 ... 4].map { .caption($0.id) }))
    }

    /// A run only ever reaches across one track, so shift-clicking a cutaway
    /// after a caption starts again rather than sweeping both up.
    @Test func aRunStaysOnOneTrack() async {
        let session = await session()
        let cues = session.captionCues
        let overlays = session.overlays

        session.selectTimelineItem(.caption(cues[0].id))
        session.selectTimelineItem(.overlay(overlays[2].id), ranging: true)

        #expect(session.timelineSelection.contains(.overlay(overlays[2].id)))
        #expect(!session.timelineSelection.contains(.overlay(overlays[0].id)))
    }

    @Test func shiftClickWorksOnCutawaysAsWell() async {
        let session = await session()
        let overlays = session.overlays

        session.selectTimelineItem(.overlay(overlays[0].id))
        session.selectTimelineItem(.overlay(overlays[3].id), ranging: true)

        #expect(session.selectedOverlayIDs == Set(overlays.map(\.id)))
    }

    /// Command-click still picks one out without disturbing the rest, and it
    /// becomes the place the next run reaches back from.
    @Test func commandClickTogglesAndMovesTheAnchor() async {
        let session = await session()
        let cues = session.captionCues

        session.selectTimelineItem(.caption(cues[0].id))
        session.selectTimelineItem(.caption(cues[3].id), toggling: true)
        session.selectTimelineItem(.caption(cues[4].id), ranging: true)

        #expect(session.timelineSelection == Set([cues[0], cues[3], cues[4]].map { .caption($0.id) }))
    }
}

private actor QuietRangeStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

/// The caption list is a list, so its clicks answer to the same modifiers.
@MainActor
@Suite struct CaptionListRangeSelectionTests {
    private let mediaID = UUID()

    private func session() async -> EditorSession {
        let session = EditorSession(store: QuietListRangeStore())
        for _ in 0 ..< 500 where session.isBusy { await Task.yield() }
        session.updateProject { project in
            project.media = [ProjectMedia(
                id: self.mediaID,
                url: URL(filePath: "/tmp/list-range.mov"),
                name: "list-range.mov",
                duration: 8,
                width: 160,
                height: 90,
                hasAudio: false
            )]
            project.clips = [TimelineClip(mediaID: self.mediaID, sourceStart: 0, sourceEnd: 4)]
            project.transcript = (0 ..< 6).map { index in
                TranscriptWord(
                    mediaID: self.mediaID,
                    text: "word\(index)",
                    start: Double(index) * 0.5 + 0.1,
                    end: Double(index) * 0.5 + 0.3
                )
            }
            project.captionWordsPerCard = 1
            project.regenerateCaptions()
        }
        return session
    }

    @Test func shiftTakesTheRunBetweenTwoRows() async {
        let session = await session()
        let cards = session.captions

        session.pickCaption(cards[1].id, ranging: false, toggling: false)
        session.pickCaption(cards[4].id, ranging: true, toggling: false)

        #expect(session.selectedCaptionIDs == Set(cards[1 ... 4].map(\.id)))
    }

    /// The anchor stays where it was put, so a run can be stretched and pulled
    /// back in with more shift-clicks.
    @Test func theAnchorHoldsAcrossSeveralShiftClicks() async {
        let session = await session()
        let cards = session.captions

        session.pickCaption(cards[2].id, ranging: false, toggling: false)
        session.pickCaption(cards[5].id, ranging: true, toggling: false)
        session.pickCaption(cards[0].id, ranging: true, toggling: false)

        #expect(session.selectedCaptionIDs.isSuperset(of: Set(cards[0 ... 2].map(\.id))))
    }

    @Test func shiftWithNothingToReachBackToJustAdds() async {
        let session = await session()
        let cards = session.captions

        session.pickCaption(cards[3].id, ranging: true, toggling: false)

        #expect(session.selectedCaptionIDs == [cards[3].id])
    }

    @Test func commandPicksOneOutWithoutClearingTheRest() async {
        let session = await session()
        let cards = session.captions

        session.pickCaption(cards[0].id, ranging: false, toggling: false)
        session.pickCaption(cards[3].id, ranging: false, toggling: true)

        #expect(session.selectedCaptionIDs == [cards[0].id, cards[3].id])
    }
}

private actor QuietListRangeStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}
