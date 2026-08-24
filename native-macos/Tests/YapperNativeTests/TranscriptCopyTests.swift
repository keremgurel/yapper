import Foundation
import Testing

@testable import YapperNative

@Suite struct TranscriptCopyTests {
    private let mediaID = UUID()

    private func project(clips: [TimelineClip]) -> EditorProject {
        EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(filePath: "/tmp/transcript-copy.mp4"),
                    name: "transcript-copy.mp4",
                    duration: 4,
                    width: 1920,
                    height: 1080,
                    hasAudio: true
                ),
            ],
            clips: clips,
            transcript: [
                TranscriptWord(mediaID: mediaID, text: "zero", start: 0.1, end: 0.3),
                TranscriptWord(mediaID: mediaID, text: "one", start: 1.1, end: 1.3),
                TranscriptWord(mediaID: mediaID, text: "two", start: 2.1, end: 2.3),
                TranscriptWord(mediaID: mediaID, text: "three.", start: 3.1, end: 3.3),
            ]
        )
    }

    @Test func fullCopyIncludesWordsRemovedByTheEdit() {
        let subject = project(clips: [
            TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 1),
            TimelineClip(mediaID: mediaID, sourceStart: 2, sourceEnd: 4),
        ])

        #expect(subject.fullTranscriptText == "zero one two three.")
        #expect(subject.keptTranscriptText == "zero two three.")
    }

    @Test func keptCopyUsesEditedTimelineOrderAndRepeatsReusedFootage() {
        let subject = project(clips: [
            TimelineClip(mediaID: mediaID, sourceStart: 2, sourceEnd: 4),
            TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 2),
            TimelineClip(mediaID: mediaID, sourceStart: 2, sourceEnd: 3),
        ])

        #expect(subject.keptTranscriptText == "two three. zero one two")
    }
}
