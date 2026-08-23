import AppKit
import Foundation
import SwiftUI
import Testing

@testable import YapperNative

@Suite struct CaptionEditingTests {
    private let mediaID = UUID()

    private func project(
        captionsEnabled: Bool = true,
        wordsPerCard: Int? = CaptionWordsPerCard.auto
    ) -> EditorProject {
        EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(filePath: "/tmp/caption-editing.mp4"),
                    name: "caption-editing.mp4",
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
                TranscriptWord(mediaID: mediaID, text: "three", start: 0.60, end: 0.80),
                TranscriptWord(mediaID: mediaID, text: "four", start: 0.85, end: 1.05),
            ],
            captionsEnabled: captionsEnabled,
            captionWordsPerCard: wordsPerCard
        )
    }

    @MainActor
    @Test func endingAnEditReportsTheFieldEditorsNewestText() {
        var endedWith = ""
        let field = CaptionTextField(
            text: .constant(""),
            textCase: .asSpoken,
            isFocused: true,
            onFocus: {},
            onEndEditing: { endedWith = $0 },
            onSplit: { _ in },
            onMergeUp: {},
            onStep: { _ in }
        )
        let nativeField = NSTextField(string: "typed before the coalesced save")

        field.makeCoordinator().controlTextDidEndEditing(
            Notification(name: NSControl.textDidEndEditingNotification, object: nativeField)
        )

        #expect(endedWith == "typed before the coalesced save")
    }

    @Test func wordsPerCardGroupsExactlyThatManyWords() {
        var subject = project()
        subject.regenerateCaptions()
        #expect(subject.captionEntries.map(\.text) == ["one two three four"])

        subject.setCaptionWordsPerCard(2)
        #expect(subject.captionEntries.map(\.text) == ["one two", "three four"])

        subject.setCaptionWordsPerCard(1)
        #expect(subject.captionEntries.map(\.text) == ["one", "two", "three", "four"])

        subject.setCaptionWordsPerCard(CaptionWordsPerCard.auto)
        #expect(subject.captionEntries.map(\.text) == ["one two three four"])
    }

    @Test func applyToAllMovesTheSharedStyleAndClearsShadowingOverrides() {
        var subject = project()
        subject.setCaptionWordsPerCard(1)
        let ids = subject.captionEntries.map(\.id)

        // One card restyled on its own.
        subject.applyCaptionStyle(
            TextStylePatch(fontScale: 0.09),
            applyToAll: false,
            selection: [ids[0]]
        )
        #expect(subject.captionEntries[0].overrides.fontScale == 0.09)
        #expect(subject.captionEntries[1].overrides.fontScale == nil)
        #expect(subject.captionCues[0].style.fontScale == 0.09)
        #expect(subject.captionCues[1].style.fontScale == TextStyle.default.fontScale)

        // Apply-to-all has to win, so the old override cannot keep shadowing it.
        subject.applyCaptionStyle(
            TextStylePatch(fontScale: 0.06),
            applyToAll: true,
            selection: []
        )
        #expect(subject.captionStyleOrDefault.fontScale == 0.06)
        #expect(subject.captionEntries.allSatisfy { $0.overrides.fontScale == nil })
        #expect(subject.captionCues.allSatisfy { $0.style.fontScale == 0.06 })
    }

    @Test func stylingWithNothingSelectedChangesNothing() {
        var subject = project()
        subject.regenerateCaptions()
        let before = subject

        subject.applyCaptionStyle(
            TextStylePatch(font: .editorial),
            applyToAll: false,
            selection: []
        )
        #expect(subject.captions == before.captions)
        #expect(subject.captionStyleOrDefault == before.captionStyleOrDefault)
    }

    @Test func casingIsDisplayOnlyAndFullyRevertible() {
        var subject = project()
        subject.regenerateCaptions()
        subject.applyCaptionStyle(TextStylePatch(textCase: .upper), applyToAll: true, selection: [])
        #expect(subject.captionCues[0].displayText == "ONE TWO THREE FOUR")
        #expect(subject.captionEntries[0].text == "one two three four")

        subject.applyCaptionStyle(TextStylePatch(textCase: .asSpoken), applyToAll: true, selection: [])
        #expect(subject.captionCues[0].displayText == "one two three four")
    }

    @Test func typingOutranksTheSharedCasingTransform() {
        var subject = project()
        subject.regenerateCaptions()
        subject.applyCaptionStyle(TextStylePatch(textCase: .upper), applyToAll: true, selection: [])
        let id = subject.captionEntries[0].id

        subject.setCaptionText("Yapper", for: id)
        #expect(subject.captionCues[0].displayText == "Yapper")
    }

    @Test func splitCutsAtTheWordAndKeepsBothHalvesInTime() {
        var subject = project()
        subject.regenerateCaptions()
        let original = subject.captionEntries[0]

        let tailID = subject.splitCaption(original.id, afterWords: 2)
        #expect(tailID != nil)
        #expect(subject.captionEntries.map(\.text) == ["one two", "three four"])
        #expect(subject.captionEntries[0].sourceStart == original.sourceStart)
        #expect(subject.captionEntries[1].sourceEnd == original.sourceEnd)
        #expect(subject.captionEntries[0].sourceEnd == subject.captionEntries[1].sourceStart)
    }

    @Test func singleWordCaptionsNeverSplitIntoAnEmptyGhost() {
        var subject = project()
        subject.setCaptionWordsPerCard(1)
        let id = subject.captionEntries[0].id
        #expect(subject.splitCaption(id, afterWords: 1) == nil)
        #expect(subject.captionEntries.count == 4)
    }

    @Test func mergeSpansTheWholeRangeInSpokenOrder() {
        var subject = project()
        subject.setCaptionWordsPerCard(1)
        let ids = subject.captionEntries.map(\.id)
        let firstStart = subject.captionEntries[0].sourceStart
        let lastEnd = subject.captionEntries[2].sourceEnd

        subject.mergeCaptions([ids[2], ids[0], ids[1]])
        #expect(subject.captionEntries.map(\.text) == ["one two three", "four"])
        #expect(subject.captionEntries[0].sourceStart == firstStart)
        #expect(subject.captionEntries[0].sourceEnd == lastEnd)
    }

    @Test func mergingFewerThanTwoCardsIsANoOp() {
        var subject = project()
        subject.setCaptionWordsPerCard(1)
        let before = subject.captions
        subject.mergeCaptions([subject.captionEntries[0].id])
        #expect(subject.captions == before)
    }

    @Test func handEditedCardsRetimeAfterACutAndDropWhenTheirWordsGo() {
        var subject = project()
        subject.setCaptionWordsPerCard(1)
        subject.setCaptionText("edited", for: subject.captionEntries[1].id)
        #expect(subject.captionCues[1].timelineStart > 0.3)

        // Remove the first half-second of the recording: the survivors keep
        // their text and slide earlier, and "one" goes with its words.
        subject.removeSourceRanges([(0, 0.33)], for: mediaID)
        #expect(subject.captionEntries.map(\.text).contains("edited"))
        #expect(subject.captionCues.map(\.text) == ["edited", "three", "four"])
        #expect(subject.captionCues[0].timelineStart < 0.1)
    }

    @Test func addingACaptionAtThePlayheadStopsBeforeTheNextOne() {
        var subject = project()
        subject.setCaptionWordsPerCard(1)
        let created = subject.addCaption(atTimelineTime: 0.0)
        #expect(created?.text == "New caption")
        // "one" already starts at 0.075, so the new card cannot run its full
        // default length without overlapping it.
        #expect((created?.sourceEnd ?? 0) < 0.4)
        #expect(subject.captionEntries.count == 5)
    }

    @Test func hidingCaptionsKeepsTheCardsForWhenTheyComeBack() {
        var subject = project()
        subject.regenerateCaptions()
        subject.setCaptionText("kept", for: subject.captionEntries[0].id)

        subject.captionsEnabled = false
        #expect(subject.captionCues.isEmpty)

        subject.captionsEnabled = true
        #expect(subject.captionEntries.map(\.text) == ["kept"])
    }

    @Test func projectsSavedBeforeCaptionsWereEditableStillShowCards() {
        // `captions` and `captionWordsPerCard` are both nil, the shape every
        // project had before this feature. Cards still appear, grouped at the
        // three-words default.
        let legacy = project(wordsPerCard: nil)
        #expect(legacy.captions == nil)
        // The historical three-word default remains literal too.
        #expect(legacy.captionCues.map(\.text) == ["one two three", "four"])
    }

    @Test func exportStyleFollowsThePerCaptionOverride() {
        var subject = project()
        subject.setCaptionWordsPerCard(2)
        let ids = subject.captionEntries.map(\.id)
        subject.applyCaptionStyle(
            TextStylePatch(x: 0.25, y: 0.4, font: .editorial),
            applyToAll: false,
            selection: [ids[1]]
        )

        #expect(subject.captionCues[0].style.font == TextStyle.default.font)
        #expect(subject.captionCues[1].style.font == .editorial)
        #expect(subject.captionCues[1].style.x == 0.25)
        #expect(subject.captionCues[1].style.y == 0.4)
    }
}

extension CaptionEditingTests {
    @Test func defaultsMatchTheShippedShortFormLook() {
        let style = TextStyle.default
        #expect(style.font == .modern)
        #expect((style.fontScale * 1000).rounded() == 24)
        #expect(style.appearance.backgroundEnabled == false)
        #expect(style.appearance.color == .white)
        #expect(CaptionWordsPerCard.normalized(nil) == 3)
    }

    @Test func aCardNeverSpansACutEvenAtAFixedWordCount() {
        let mediaID = UUID()
        var subject = EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(filePath: "/tmp/caption-cut.mp4"),
                    name: "caption-cut.mp4",
                    duration: 4,
                    width: 1080,
                    height: 1920,
                    hasAudio: true
                ),
            ],
            // The recording's second 1..2 is cut, so "two" and "three" sit next
            // to each other on the timeline while their anchors are a second
            // apart. A card holding both would map to nothing.
            clips: [
                TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 1),
                TimelineClip(mediaID: mediaID, sourceStart: 2, sourceEnd: 4),
            ],
            transcript: [
                TranscriptWord(mediaID: mediaID, text: "one", start: 0.10, end: 0.30),
                TranscriptWord(mediaID: mediaID, text: "two", start: 0.40, end: 0.60),
                TranscriptWord(mediaID: mediaID, text: "three", start: 2.10, end: 2.30),
                TranscriptWord(mediaID: mediaID, text: "four", start: 2.40, end: 2.60),
            ],
            captionsEnabled: true,
            captionWordsPerCard: 3
        )
        subject.regenerateCaptions()

        #expect(subject.captionEntries.map(\.text) == ["one two", "three four"])
        #expect(subject.captionCues.map(\.text) == ["one two", "three four"])
    }
}
