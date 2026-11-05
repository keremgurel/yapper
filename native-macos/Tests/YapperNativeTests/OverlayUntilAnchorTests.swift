@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor UntilAnchorStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {}
}

/// "While I say X": an overlay that ends where a phrase does, resolved from
/// the transcript rather than from the planner's arithmetic.
@MainActor
@Suite(.serialized)
struct OverlayUntilAnchorTests {
    private func session() async throws -> (EditorSession, UUID, URL) {
        let root = FileManager.default.temporaryDirectory.appending(path: "overlay-until-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let mainURL = root.appending(path: "main.mov"), brollURL = root.appending(path: "broll.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 8, to: mainURL)
        try await SyntheticVideo.write(color: NSColor.blue.cgColor, size: CGSize(width: 160, height: 90), seconds: 3, to: brollURL)
        let main = try await MediaProbe.inspect(url: mainURL), broll = try await MediaProbe.inspect(url: brollURL)
        let spoken: [(String, Double, Double)] = [
            ("Comment", 0.5, 0.9), ("TEF", 1.0, 1.4), ("below", 1.5, 1.9),
            ("and", 3.0, 3.2), ("comment", 3.3, 3.7), ("TEF", 3.8, 4.2), ("again", 4.3, 4.8),
        ]
        var project = EditorProject(media: [main, broll], clips: [TimelineClip(mediaID: main.id, sourceStart: 0, sourceEnd: 8)])
        project.transcript = spoken.map { TranscriptWord(mediaID: main.id, text: $0.0, start: $0.1, end: $0.2) }
        let session = EditorSession(store: UntilAnchorStore())
        await Task.yield()
        session.updateProject { $0 = project }
        return (session, broll.id, root)
    }

    private func phrase(_ text: String, occurrence: Int? = nil) -> TimelineAnchorInput {
        TimelineAnchorInput(kind: .phrase, time: nil, phrase: text, occurrence: occurrence, eventID: nil, offset: nil)
    }

    private func time(_ seconds: Double) -> TimelineAnchorInput {
        TimelineAnchorInput(kind: .time, time: seconds, phrase: nil, occurrence: nil, eventID: nil, offset: nil)
    }

    @Test func whileISayAPhraseCoversExactlyThatPhrase() async throws {
        let (session, broll, root) = try await session()
        defer { try? FileManager.default.removeItem(at: root); session.player.replaceCurrentItem(with: nil) }

        let result = await session.performAppAction(OverlayAddInput(
            mediaID: broll, at: phrase("Comment TEF below"), duration: nil, until: phrase("Comment TEF below"), sourceStart: nil))

        #expect(result.status == .applied)
        let overlay = try #require(session.overlays.first)
        #expect(abs(overlay.timelineStart - 0.5) < 1e-6)
        #expect(abs(overlay.timelineStart + overlay.duration - 1.9) < 1e-6)
    }

    @Test func untilARepeatedPhraseMeansTheNextTimeItIsSaid() async throws {
        let (session, broll, root) = try await session()
        defer { try? FileManager.default.removeItem(at: root); session.player.replaceCurrentItem(with: nil) }

        // "comment TEF" is said twice; from 2.5 s the next one begins at 3.3 s,
        // and "until I say it" is gone by then.
        let result = await session.performAppAction(OverlayAddInput(
            mediaID: broll, at: time(2.5), duration: nil, until: phrase("comment TEF"), sourceStart: nil))

        #expect(result.status == .applied)
        let overlay = try #require(session.overlays.first)
        #expect(abs(overlay.timelineStart + overlay.duration - 3.3) < 1e-6)
    }

    @Test func fromOnePhraseUntilAnotherEndsWhereTheSecondBegins() async throws {
        let (session, broll, root) = try await session()
        defer { try? FileManager.default.removeItem(at: root); session.player.replaceCurrentItem(with: nil) }

        let result = await session.performAppAction(OverlayAddInput(
            mediaID: broll, at: phrase("TEF below"), duration: nil, until: phrase("and comment"), sourceStart: nil))

        #expect(result.status == .applied)
        let overlay = try #require(session.overlays.first)
        #expect(abs(overlay.timelineStart - 1.0) < 1e-6)
        #expect(abs(overlay.timelineStart + overlay.duration - 3.0) < 1e-6)
    }

    @Test func aLengthJustPastTheClipIsTrimmedToIt() async throws {
        let (session, broll, root) = try await session()
        defer { try? FileManager.default.removeItem(at: root); session.player.replaceCurrentItem(with: nil) }
        let clip = try #require(session.project.media.first { $0.id == broll })

        // "3.03 seconds" for a 3 s clip is rounding, not a request to overrun.
        let result = await session.performAppAction(OverlayAddInput(
            mediaID: broll, at: time(0.5), duration: clip.duration + 0.03, until: nil, sourceStart: nil))

        #expect(result.status == .applied)
        #expect(abs((session.overlays.first?.duration ?? 0) - clip.duration) < 1e-6)
        let far = await session.performAppAction(OverlayAddInput(
            mediaID: broll, at: time(4), duration: clip.duration + 0.5, until: nil, sourceStart: nil))
        #expect(far.status == .rejected && far.message.contains(clip.name))
    }

    @Test func impossibleEndsAreRejectedWithAReason() async throws {
        let (session, broll, root) = try await session()
        defer { try? FileManager.default.removeItem(at: root); session.player.replaceCurrentItem(with: nil) }

        let both = await session.performAppAction(OverlayAddInput(
            mediaID: broll, at: time(0.5), duration: 2, until: phrase("below"), sourceStart: nil))
        #expect(both.status == .rejected && both.message.contains("not both"))

        let before = await session.performAppAction(OverlayAddInput(
            mediaID: broll, at: time(5), duration: nil, until: phrase("below"), sourceStart: nil))
        #expect(before.status == .rejected && before.message.contains("is not said after the overlay starts"))

        // The B-roll is 3 s long; 0.5 s until "again" (4.3 s) would need more.
        let tooLong = await session.performAppAction(OverlayAddInput(
            mediaID: broll, at: time(0.5), duration: nil, until: phrase("again"), sourceStart: nil))
        #expect(tooLong.status == .rejected && tooLong.message.contains("shorter than"))

        #expect(session.overlays.isEmpty)
    }
}
