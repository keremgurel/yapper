import Foundation
import Testing

@testable import YapperNative

/// Hiding captions is a visibility switch, not a delete. The cards, their
/// hand-edited text and their restyling all have to survive it.
@Suite struct CaptionVisibilityTests {
    private let mediaID = UUID()

    private func project(captionsEnabled: Bool = true) -> EditorProject {
        EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(filePath: "/tmp/caption-visibility.mp4"),
                    name: "caption-visibility.mp4",
                    duration: 4,
                    width: 1080,
                    height: 1920,
                    hasAudio: true
                ),
            ],
            clips: [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 4)],
            transcript: [
                TranscriptWord(mediaID: mediaID, text: "one", start: 0.10, end: 0.30),
                TranscriptWord(mediaID: mediaID, text: "two", start: 0.35, end: 0.55),
            ],
            captionsEnabled: captionsEnabled,
            captionWordsPerCard: 1
        )
    }

    @Test func hidingKeepsTheCardsAndShowingBringsThemBack() {
        var subject = project()
        subject.regenerateCaptions()
        let id = subject.storedCaptions[0].id
        subject.setCaptionText("hand edited", for: id)

        subject.setCaptionsVisible(false)

        // Nothing is drawn or burned in…
        #expect(subject.captionEntries.isEmpty)
        #expect(subject.captionCues.isEmpty)
        // …but the panel still has every card to edit.
        #expect(subject.storedCaptions.count == 2)
        #expect(subject.storedCaptions[0].text == "hand edited")

        subject.setCaptionsVisible(true)
        #expect(subject.captionEntries.map(\.text) == ["hand edited", "two"])
    }

    /// The regression this suite exists for: a project saved before captions
    /// became editable stores no cards, only the switch. Hiding it used to lose
    /// them, because the derived cards were only computed while it was on.
    @Test func hidingALegacyProjectMaterializesItsCardsFirst() {
        var subject = project()
        #expect(subject.captions == nil)
        #expect(subject.storedCaptions.count == 2)

        subject.setCaptionsVisible(false)

        #expect(subject.storedCaptions.count == 2)
        #expect(subject.captionEntries.isEmpty)
    }

    @Test func regroupingStillRebuildsCardsWhileHidden() {
        var subject = project()
        subject.regenerateCaptions()
        subject.setCaptionsVisible(false)

        subject.setCaptionWordsPerCard(2)

        #expect(subject.storedCaptions.map(\.text) == ["one two"])
    }

    /// Clearing is the delete, and it does empty the project.
    @Test func clearingRemovesTheCards() {
        var subject = project()
        subject.regenerateCaptions()

        subject.clearCaptions()

        #expect(subject.storedCaptions.isEmpty)
        #expect(subject.captionsEnabled == false)
    }

    @Test func aProjectThatNeverHadCaptionsHasNone() {
        let subject = project(captionsEnabled: false)
        #expect(subject.storedCaptions.isEmpty)
        #expect(subject.captionEntries.isEmpty)
    }
}
