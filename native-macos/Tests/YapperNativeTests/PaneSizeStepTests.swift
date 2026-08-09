import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// Rounding a pane's size so the things that only need it roughly hear from a
/// divider drag a few times instead of sixty times a second.
struct PaneSizeStepTests {
    @Test func aSizeIsRoundedDownToTheStep() {
        #expect(PaneSizeStep.rounded(719, step: 16) == 704)
        #expect(PaneSizeStep.rounded(720, step: 16) == 720)
        #expect(PaneSizeStep.rounded(735, step: 16) == 720)
    }

    @Test func everySizeInsideAStepGivesTheSameAnswer() {
        let answers = Set((720 ..< 736).map { PaneSizeStep.rounded(CGFloat($0), step: 16) })
        #expect(answers == [720])
    }

    @Test func aStepOfNothingLeavesTheSizeAlone() {
        #expect(PaneSizeStep.rounded(719.5, step: 0) == 719.5)
    }
}

/// Asking whether the edit has been transcribed must not cost a pass over the
/// transcript: it is read from a view body.
struct TimelineTranscriptPresenceTests {
    private func project(clipMedia: [UUID], transcriptMedia: [UUID]) -> EditorProject {
        EditorProject(
            clips: clipMedia.map { TimelineClip(mediaID: $0, sourceStart: 0, sourceEnd: 1) },
            transcript: transcriptMedia.map {
                TranscriptWord(mediaID: $0, text: "word", start: 0, end: 0.2)
            }
        )
    }

    @Test func theCheapAnswerMatchesTheExpensiveOne() {
        let onTimeline = UUID()
        let inTheBinOnly = UUID()
        let cases = [
            project(clipMedia: [onTimeline], transcriptMedia: [onTimeline]),
            project(clipMedia: [onTimeline], transcriptMedia: [inTheBinOnly]),
            project(clipMedia: [], transcriptMedia: [onTimeline]),
            project(clipMedia: [onTimeline], transcriptMedia: []),
        ]
        for project in cases {
            #expect(project.hasTimelineTranscript == !project.timelineTranscript.isEmpty)
        }
    }

    @Test func wordsBelongingToDeletedClipsDoNotCount() {
        let project = project(clipMedia: [UUID()], transcriptMedia: [UUID()])
        #expect(!project.hasTimelineTranscript)
    }
}
