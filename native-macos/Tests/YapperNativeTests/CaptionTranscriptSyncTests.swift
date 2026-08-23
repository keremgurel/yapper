import Foundation
import Testing

@testable import YapperNative

/// A caption card is anchored to a stretch of the recording, so what it says has
/// to be whatever survives inside that stretch. Cutting a word in the transcript
/// takes it off the card; restoring it puts it back.
@Suite struct CaptionTranscriptSyncTests {
    private let mediaID = UUID()

    private func project(wordsPerCard: Int = 4) -> EditorProject {
        EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(filePath: "/tmp/caption-sync.mp4"),
                    name: "caption-sync.mp4",
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

    /// The word "two" spans 0.40 to 0.60, so cutting that stretch is what the
    /// transcript panel does when a word is deleted.
    private func cutTwo(_ project: inout EditorProject) {
        project.removeSourceRanges([(0.35, 0.65)], for: mediaID)
    }

    @Test func cuttingAWordTakesItOffItsCard() {
        var subject = project()
        subject.regenerateCaptions()
        #expect(subject.captionCues.map(\.text) == ["one two three four"])

        cutTwo(&subject)

        #expect(subject.captionCues.map(\.text) == ["one three four"])
    }

    @Test func restoringAWordPutsItBack() {
        var subject = project()
        subject.regenerateCaptions()
        cutTwo(&subject)
        #expect(subject.captionCues.map(\.text) == ["one three four"])

        subject.restoreSourceRange((0.35, 0.65), for: mediaID)

        #expect(subject.captionCues.map(\.text) == ["one two three four"])
    }

    /// A card the creator has typed into is theirs, and a later transcript edit
    /// must not rewrite it underneath them.
    @Test func aTypedCardStopsFollowingTheTranscript() {
        var subject = project()
        subject.regenerateCaptions()
        let id = subject.storedCaptions[0].id
        subject.setCaptionText("my own words", for: id)

        cutTwo(&subject)

        #expect(subject.captionCues.map(\.text) == ["my own words"])
    }

    @Test func aCardWhoseWordsAreAllCutDrawsNothing() {
        var subject = project(wordsPerCard: 1)
        subject.regenerateCaptions()
        #expect(subject.storedCaptions.count == 4)

        cutTwo(&subject)

        // The card survives in the project so restoring the word brings it
        // back, but neither the list nor the video exposes an empty ghost.
        #expect(subject.storedCaptions.count == 4)
        #expect(subject.captionCues.map(\.text) == ["one", "three", "four"])
        #expect(
            CaptionListProjection.visibleCaptions(
                from: subject.storedCaptions,
                textsByID: subject.captionTextsByID
            ).map(\.text) == ["one", "three", "four"]
        )
    }

    @Test func aFocusedEmptyInsertionStaysVisibleOnlyWhileItIsBeingEdited() {
        var subject = project(wordsPerCard: 1)
        subject.regenerateCaptions()
        let first = subject.storedCaptions[0]
        let inserted = subject.addCaption(after: first.id)
        #expect(inserted != nil)

        let withoutFocus = CaptionListProjection.visibleCaptions(
            from: subject.storedCaptions,
            textsByID: subject.captionTextsByID
        )
        let withFocus = CaptionListProjection.visibleCaptions(
            from: subject.storedCaptions,
            textsByID: subject.captionTextsByID,
            focusedID: inserted?.id
        )

        #expect(withoutFocus.contains { $0.id == inserted?.id } == false)
        #expect(withFocus.contains { $0.id == inserted?.id })
    }

    @Test func aCardStartsAtWhicheverWordSurvives() {
        var subject = project(wordsPerCard: 2)
        subject.regenerateCaptions()
        #expect(subject.storedCaptions.map(\.text) == ["one two", "three four"])

        // Cut the first word rather than the second.
        subject.removeSourceRanges([(0.05, 0.35)], for: mediaID)

        #expect(subject.captionCues.map(\.text) == ["two", "three four"])
        let firstCue = subject.captionCues[0]
        // It now begins with "two", so it must not still be waiting out the
        // seconds where "one" used to be.
        #expect(firstCue.timelineStart < 0.1)
    }

    @Test func aCardAddedByHandKeepsItsOwnText() {
        var subject = project()
        subject.regenerateCaptions()

        let added = subject.addCaption(atTimelineTime: 0.5)

        #expect(added?.isTextEdited == true)
        #expect(subject.captionCues.map(\.text).contains("New caption"))
    }

    @Test func splittingLeavesBothHalvesFollowingTheTranscript() {
        var subject = project()
        subject.regenerateCaptions()
        let id = subject.storedCaptions[0].id

        subject.splitCaption(id, afterWords: 2)

        #expect(subject.storedCaptions.allSatisfy { !$0.isTextEdited })
        #expect(subject.captionCues.map(\.text) == ["one two", "three four"])

        cutTwo(&subject)
        #expect(subject.captionCues.map(\.text) == ["one", "three four"])
    }

    @Test func mergingLeavesTheCardFollowingTheTranscript() {
        var subject = project(wordsPerCard: 2)
        subject.regenerateCaptions()
        let ids = Set(subject.storedCaptions.map(\.id))

        subject.mergeCaptions(ids)

        #expect(subject.storedCaptions.count == 1)
        #expect(subject.storedCaptions[0].isTextEdited == false)
        #expect(subject.captionCues.map(\.text) == ["one two three four"])

        cutTwo(&subject)
        #expect(subject.captionCues.map(\.text) == ["one three four"])
    }

    /// Merging a typed card into a spoken one keeps the typed words, because
    /// dropping them would lose work.
    @Test func mergingATypedCardKeepsItsWords() {
        var subject = project(wordsPerCard: 2)
        subject.regenerateCaptions()
        let ids = subject.storedCaptions.map(\.id)
        subject.setCaptionText("hello there", for: ids[0])

        subject.mergeCaptions(Set(ids))

        #expect(subject.storedCaptions[0].isTextEdited)
        #expect(subject.captionCues.map(\.text) == ["hello there three four"])
    }

    /// Cards saved before this existed were never marked either way, and none of
    /// them was typed into through the flag, so they all start out listening.
    @Test func cardsSavedBeforeThisFollowTheTranscript() throws {
        let saved = """
        {
          "id": "0B2E4D0E-2C6E-4D5E-9E37-9D4F1E86F6A2",
          "mediaID": "1B2E4D0E-2C6E-4D5E-9E37-9D4F1E86F6A3",
          "text": "one two",
          "sourceStart": 0,
          "sourceEnd": 1
        }
        """
        let caption = try JSONDecoder().decode(ProjectCaption.self, from: Data(saved.utf8))
        #expect(caption.isTextEdited == false)
    }
}
