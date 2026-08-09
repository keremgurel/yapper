import Foundation
import Testing
@testable import YapperNative

/// Stretching a caption must never make one disappear — neither the card being
/// stretched nor the one it was stretched over.
struct CaptionRetimeSurvivalTests {
    private let mediaID = UUID()

    /// Ten seconds of speech, two words a second, in two caption cards.
    private func project(clips: [TimelineClip]? = nil) -> EditorProject {
        let media = ProjectMedia(
            id: mediaID,
            url: URL(filePath: "/tmp/talk.mp4"),
            name: "talk.mp4",
            duration: 10,
            width: 1_080,
            height: 1_920,
            hasAudio: true
        )
        let transcript = (0 ..< 20).map { index in
            TranscriptWord(
                mediaID: mediaID,
                text: "word\(index)",
                start: Double(index) * 0.5,
                end: Double(index) * 0.5 + 0.4
            )
        }
        return EditorProject(
            media: [media],
            clips: clips ?? [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 10)],
            transcript: transcript,
            captionsEnabled: true,
            captions: [
                ProjectCaption(mediaID: mediaID, text: "first card", sourceStart: 0, sourceEnd: 4.9),
                ProjectCaption(mediaID: mediaID, text: "second card", sourceStart: 5, sourceEnd: 9.9),
            ]
        )
    }

    @Test func stretchingACardOverItsNeighbourLeavesBothOnTheTimeline() {
        var project = self.project()
        let first = project.storedCaptions[0].id
        let second = project.storedCaptions[1].id

        // Pull the first card's end out over the whole of the second.
        let retimed = project.retimeCaption(first, toTimelineStart: 0, end: 9.5)
        #expect(retimed)

        let ids = project.captionCues.map(\.id)
        #expect(ids.contains(first))
        #expect(ids.contains(second))
        // And the second card still says what it said.
        #expect(project.captionTextsByID[second]?.isEmpty == false)
    }

    @Test func aCardDraggedInsideAnothersRangeDoesNotSwallowIt() {
        var project = self.project()
        let first = project.storedCaptions[0].id
        let second = project.storedCaptions[1].id

        // The first card is dragged forward so it starts inside the second and
        // covers the rest of it: the words underneath belong to both, and the
        // one that started later used to take them all.
        let retimed = project.retimeCaption(first, toTimelineStart: 5.2, end: 9.8)
        #expect(retimed)

        let ids = project.captionCues.map(\.id)
        #expect(ids.contains(second))
        #expect(ids.contains(first))
        #expect(project.captionTextsByID[second]?.isEmpty == false)
    }

    @Test func aCardStretchedOverTheWholeVideoStaysOnScreen() {
        var project = self.project()
        let first = project.storedCaptions[0].id
        let retimed = project.retimeCaption(first, toTimelineStart: 0, end: 10)
        #expect(retimed)
        #expect(project.captionCues.contains { $0.id == first })
    }

    @Test func aCardStretchedAcrossACutSurvivesTheGap() {
        // The middle of the recording has been cut out, so a card stretched
        // from one side to the other spans a hole.
        var project = self.project(clips: [
            TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 3),
            TimelineClip(mediaID: mediaID, sourceStart: 7, sourceEnd: 10),
        ])
        let first = project.storedCaptions[0].id
        let retimed = project.retimeCaption(first, toTimelineStart: 0.5, end: 5)
        #expect(retimed)

        let cue = project.captionCues.first { $0.id == first }
        #expect(cue != nil)
        #expect((cue?.duration ?? 0) > 0)
    }

    @Test func aCardThatWasNeverTouchedStillFollowsItsWords() {
        var project = self.project()
        let second = project.storedCaptions[1].id
        // Cutting the words out from under an untouched card still removes it:
        // that is the behaviour retiming must not break.
        project.removeSourceRanges([(4.5, 10)], for: mediaID)
        #expect(!project.captionCues.contains { $0.id == second })
    }
}
