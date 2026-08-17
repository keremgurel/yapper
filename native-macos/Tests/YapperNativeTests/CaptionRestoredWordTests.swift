import AppKit
import CoreGraphics
import Foundation
import Testing

@testable import YapperNative

/// Cards are built over the words that are in the cut, so a word cut at the
/// time the cards were made has no card near it. Bringing that word back in the
/// transcript used to put the line back in the video silently, and the only
/// caption for it came from a full regenerate.
@MainActor
@Suite struct CaptionRestoredWordTests {
    private let mediaID = UUID()

    private func project(
        wordsPerCard: Int,
        url: URL = URL(filePath: "/tmp/caption-restore.mp4")
    ) -> EditorProject {
        EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: url,
                    name: url.lastPathComponent,
                    duration: 4,
                    width: 1080,
                    height: 1920,
                    hasAudio: true
                ),
            ],
            clips: [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 4)],
            transcript: [
                TranscriptWord(mediaID: mediaID, text: "one", start: 0.10, end: 0.30),
                TranscriptWord(mediaID: mediaID, text: "two", start: 0.40, end: 0.60),
                TranscriptWord(mediaID: mediaID, text: "three", start: 0.70, end: 0.90),
                TranscriptWord(mediaID: mediaID, text: "four", start: 1.00, end: 1.20),
            ],
            captionsEnabled: true,
            captionWordsPerCard: wordsPerCard
        )
    }

    /// Captions made while "two" was cut, which is what a one-click edit leaves
    /// behind: no card covers that stretch of the recording.
    private func editedWithoutTwo(
        wordsPerCard: Int = 1,
        url: URL = URL(filePath: "/tmp/caption-restore.mp4")
    ) -> EditorProject {
        var subject = project(wordsPerCard: wordsPerCard, url: url)
        subject.removeSourceRanges([(0.35, 0.65)], for: mediaID)
        subject.regenerateCaptions()
        return subject
    }

    @Test func aRestoredWordGetsACard() {
        var subject = editedWithoutTwo()
        #expect(subject.captionCues.map(\.text) == ["one", "three", "four"])

        subject.restoreSourceRange((0.35, 0.65), for: mediaID)
        subject.captionRestoredWords()

        #expect(subject.captionCues.map(\.text) == ["one", "two", "three", "four"])
    }

    /// The new card has to sit in the gap, not over the cards either side: a
    /// word belongs to the last card containing it, so an overlapping card
    /// would take its neighbour's words and leave that neighbour blank.
    @Test func theNewCardLeavesItsNeighboursAlone() {
        var subject = editedWithoutTwo()
        let before = subject.storedCaptions.map { ($0.sourceStart, $0.sourceEnd) }

        subject.restoreSourceRange((0.35, 0.65), for: mediaID)
        subject.captionRestoredWords()

        let kept = subject.storedCaptions.filter { caption in
            before.contains { $0.0 == caption.sourceStart && $0.1 == caption.sourceEnd }
        }
        #expect(kept.count == before.count)
        #expect(subject.storedCaptions.count == before.count + 1)
    }

    /// Running it twice must not stack a second card on the same words.
    @Test func fillingTheGapTwiceAddsNothing() {
        var subject = editedWithoutTwo()
        subject.restoreSourceRange((0.35, 0.65), for: mediaID)
        subject.captionRestoredWords()
        let filled = subject.storedCaptions.count

        subject.captionRestoredWords()

        #expect(subject.storedCaptions.count == filled)
        #expect(subject.captionCues.map(\.text) == ["one", "two", "three", "four"])
    }

    /// A card that already reaches the restored word picks it up on its own, so
    /// nothing new should be minted there. This is the cut-then-restore case the
    /// cards have always handled, and it must keep behaving that way.
    @Test func aWordACardAlreadyReachesIsLeftToThatCard() {
        var subject = project(wordsPerCard: 0)
        subject.regenerateCaptions()
        let cards = subject.storedCaptions.count
        subject.removeSourceRanges([(0.35, 0.65)], for: mediaID)

        subject.restoreSourceRange((0.35, 0.65), for: mediaID)
        subject.captionRestoredWords()

        #expect(subject.storedCaptions.count == cards)
        #expect(subject.captionCues.map(\.text) == ["one two three four"])
    }

    /// Cards the creator typed into are theirs. Filling a gap beside one must
    /// not rewrite it, and must not lay a card across the stretch it holds.
    @Test func typedCardsSurviveTheFill() {
        var subject = editedWithoutTwo()
        let typed = subject.storedCaptions[0].id
        subject.setCaptionText("my own words", for: typed)

        subject.restoreSourceRange((0.35, 0.65), for: mediaID)
        subject.captionRestoredWords()

        #expect(subject.caption(withID: typed)?.text == "my own words")
        #expect(subject.captionCues.map(\.text) == ["my own words", "two", "three", "four"])
    }

    /// With captions off there are no cards to keep in step, and minting some
    /// here would turn them on behind the creator's back.
    @Test func captionsStayOffWhenTheyAreOff() {
        var subject = editedWithoutTwo()
        subject.clearCaptions()

        subject.restoreSourceRange((0.35, 0.65), for: mediaID)
        subject.captionRestoredWords()

        #expect(subject.captionsEnabled == false)
        #expect(subject.storedCaptions.isEmpty)
    }

    /// The other half of the ask: a word taken out of the transcript comes off
    /// the caption with it.
    @Test func aDeletedWordLeavesTheCaption() {
        var subject = project(wordsPerCard: 0)
        subject.regenerateCaptions()
        #expect(subject.captionCues.map(\.text) == ["one two three four"])

        subject.removeSourceRanges([(0.35, 0.65)], for: mediaID)

        #expect(subject.captionCues.map(\.text) == ["one three four"])
    }

    /// The restore the creator actually performs is in the transcript panel,
    /// which goes through the session.
    @Test func restoringFromTheTranscriptCaptionsTheLine() async throws {
        let url = URL(filePath: NSTemporaryDirectory())
            .appending(path: "caption-restore-\(UUID().uuidString).mov")
        try await SyntheticVideo.write(
            color: NSColor.black.cgColor,
            size: CGSize(width: 160, height: 90),
            seconds: 4,
            to: url
        )
        defer { try? FileManager.default.removeItem(at: url) }

        let session = EditorSession(store: QuietCaptionStore())
        await Task.yield()
        var edited = editedWithoutTwo(url: url)
        edited.id = session.project.id
        session.updateProject { $0 = edited }

        let two = session.project.transcript?.first { $0.text == "two" }
        await session.restoreTranscriptWords([two!])

        #expect(session.project.captionCues.map(\.text) == ["one", "two", "three", "four"])
    }
}

private actor QuietCaptionStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}
