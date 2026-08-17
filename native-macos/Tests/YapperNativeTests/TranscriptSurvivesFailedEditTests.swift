import Foundation
import Testing
@testable import YapperNative

private actor QuietStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

/// Transcribing is the slow, paid half of a one-click edit. Losing it because
/// the cleanup that followed failed means the next attempt spends another two
/// minutes and another credit hearing exactly the same words.
///
/// Run against a real fifteen minute take, two failed edits left the project
/// with no transcript at all.
@MainActor
@Suite
struct TranscriptSurvivesFailedEditTests {


    @Test("A failed edit keeps what the transcriber heard")
    func keepsTheWords() async throws {
        let mediaID = UUID()
        let session = EditorSession(
            store: QuietStore(),
            transcriptionRunner: { _, _, _ in
                [
                    TranscriptWord(mediaID: mediaID, text: "hello", start: 0, end: 0.4),
                    TranscriptWord(mediaID: mediaID, text: "there.", start: 0.4, end: 0.9),
                ]
            }
        )
        await Task.yield()
        session.updateProject { project in
            project.media = [ProjectMedia(
                id: mediaID,
                url: URL(fileURLWithPath: "/tmp/never-opened.mov"),
                name: "take",
                duration: 5,
                width: 1_080,
                height: 1_920,
                hasAudio: true,
                kind: .video
            )]
            project.clips = [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 5)]
        }

        // The cleanup cannot run in a test: no session, no server. That is the
        // failure this is about.
        await session.runOneClickEdit()

        #expect(session.errorMessage != nil)
        #expect(session.project.transcript?.isEmpty == false)
        #expect(session.project.transcript?.count == 2)
    }
}
