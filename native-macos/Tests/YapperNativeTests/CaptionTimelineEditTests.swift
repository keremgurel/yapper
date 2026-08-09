import Foundation
import Testing
@testable import YapperNative

struct CaptionTimelineEditTests {
    private let mediaID = UUID()

    /// One recording, cut into a single clip, with three words on one card.
    private func project() -> EditorProject {
        let media = ProjectMedia(
            id: mediaID,
            url: URL(filePath: "/tmp/speech.mp4"),
            name: "speech.mp4",
            duration: 20,
            width: 1_080,
            height: 1_920,
            hasAudio: true
        )
        return EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 20)],
            transcript: [
                TranscriptWord(mediaID: mediaID, text: "This", start: 1, end: 1.3),
                TranscriptWord(mediaID: mediaID, text: "stays", start: 1.35, end: 1.7),
                TranscriptWord(mediaID: mediaID, text: "here", start: 1.75, end: 2.1),
            ],
            captionsEnabled: true,
            captions: [
                ProjectCaption(
                    mediaID: mediaID,
                    text: "This stays here",
                    sourceStart: 1,
                    sourceEnd: 2.2
                ),
            ]
        )
    }

    @Test func draggingACardWritesTheNewTimeBackIntoTheRecording() {
        var project = self.project()
        let id = project.storedCaptions[0].id
        let moved = project.retimeCaption(id, toTimelineStart: 6, end: 7.4)
        #expect(moved)

        let caption = project.caption(withID: id)
        #expect(caption?.sourceStart == 6)
        #expect(caption?.sourceEnd == 7.4)
        let cue = project.captionCues.first { $0.id == id }
        #expect(cue?.timelineStart == 6)
        #expect(abs((cue?.timelineEnd ?? 0) - 7.4) < 0.0001)
    }

    @Test func aMovedCardKeepsTheWordsItWasShowing() {
        var project = self.project()
        let id = project.storedCaptions[0].id
        // Moved well past the words it was gathering.
        let moved = project.retimeCaption(id, toTimelineStart: 12, end: 13.5)
        #expect(moved)

        let caption = project.caption(withID: id)
        #expect(caption?.text == "This stays here")
        // Fixed for good: it no longer collects whatever is spoken under it.
        #expect(caption?.isTextEdited == true)
        #expect(project.captionCues.first { $0.id == id }?.text == "This stays here")
    }

    @Test func aCardCannotBeSqueezedBelowTheMinimum() {
        var project = self.project()
        let id = project.storedCaptions[0].id
        let moved = project.retimeCaption(id, toTimelineStart: 5, end: 5.05)
        #expect(!moved)
        #expect(project.caption(withID: id)?.sourceStart == 1)
    }

    @Test func aCardCannotBeDraggedOntoFootageItWasNotSpokenOver() {
        var project = self.project()
        let other = UUID()
        project.media.append(
            ProjectMedia(
                id: other,
                url: URL(filePath: "/tmp/broll.mp4"),
                name: "broll.mp4",
                duration: 5,
                width: 1_080,
                height: 1_920,
                hasAudio: false
            )
        )
        project.clips.append(TimelineClip(mediaID: other, sourceStart: 0, sourceEnd: 5))
        let id = project.storedCaptions[0].id

        // Past 20s the timeline is playing the other recording.
        let moved = project.retimeCaption(id, toTimelineStart: 21, end: 22.5)
        #expect(!moved)
        #expect(project.caption(withID: id)?.sourceStart == 1)
    }

    @Test func aDragIsHeldInsideTheTimeline() {
        let start = CaptionTimelineEdit.clampedStart(19.5, duration: 2, projectDuration: 20)
        #expect(start == 18)
        #expect(CaptionTimelineEdit.clampedStart(-3, duration: 2, projectDuration: 20) == 0)
    }

    @Test func draggingASpanMovesBothEdgesTogether() {
        let moved = CaptionTimelineEdit.moved(
            span: .init(start: 2, end: 4),
            translationX: 100,
            contentWidth: 1_000,
            projectDuration: 20
        )
        #expect(moved.start == 4)
        #expect(moved.end == 6)
    }

    @Test func trimmingAnEdgeLeavesTheOtherWhereItWas() {
        let span = CaptionTimelineEdit.Span(start: 2, end: 4)
        let leading = CaptionTimelineEdit.trimmed(
            span: span,
            edge: .leading,
            translationX: 50,
            contentWidth: 1_000,
            projectDuration: 20
        )
        #expect(leading.start == 3)
        #expect(leading.end == 4)

        let trailing = CaptionTimelineEdit.trimmed(
            span: span,
            edge: .trailing,
            translationX: -50,
            contentWidth: 1_000,
            projectDuration: 20
        )
        #expect(trailing.start == 2)
        #expect(trailing.end == 3)
    }

    @Test func trimmingCannotTurnACardInsideOut() {
        let span = CaptionTimelineEdit.Span(start: 2, end: 4)
        let crushed = CaptionTimelineEdit.trimmed(
            span: span,
            edge: .leading,
            translationX: 900,
            contentWidth: 1_000,
            projectDuration: 20
        )
        #expect(crushed.start < crushed.end)
        #expect(abs(crushed.duration - CaptionTimelineEdit.minimumDuration) < 0.0001)
    }
}
