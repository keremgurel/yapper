import Foundation
import Testing

@testable import YapperNative

/// Asking for three words a card is a promise, and a card holding one word is
/// the promise broken in the most visible way there is.
@Suite struct CaptionCardSizeTests {
    private func sizes(_ count: Int, perCard: Int) -> [Int] {
        // Plain words, so nothing but the arithmetic is under test.
        CaptionCardSizes.sizes(for: (0 ..< count).map { "word\($0)" }, perCard: perCard)
    }

    @Test func aRunThatDividesIsAllFullCards() {
        #expect(sizes(9, perCard: 3) == [3, 3, 3])
        #expect(sizes(12, perCard: 4) == [4, 4, 4])
    }

    /// Full cards are what was asked for, so a run of eight at three is two
    /// full cards and a short one rather than three cards a word light.
    @Test func fullCardsComeFirst() {
        #expect(sizes(8, perCard: 3).count { $0 == 3 } == 2)
        #expect(sizes(8, perCard: 3).reduce(0, +) == 8)
        #expect(sizes(13, perCard: 5).count { $0 == 5 } == 2)
    }

    /// The selected count is literal. A tail may be short, but earlier cards
    /// are never silently redistributed to disguise it.
    @Test func onlyTheFinalCardCanBeShort() {
        #expect(sizes(7, perCard: 3) == [3, 3, 1])
        #expect(sizes(11, perCard: 5) == [5, 5, 1])
        #expect(sizes(17, perCard: 8) == [8, 8, 1])
    }

    /// A run shorter than the count is what it is: there are no other words to
    /// make it up with.
    @Test func aShortRunStaysShort() {
        #expect(sizes(2, perCard: 4) == [2])
        #expect(sizes(1, perCard: 3) == [1])
    }

    @Test func noCardEverHoldsMoreThanTheCount() {
        for count in 1 ... 40 {
            for perCard in 1 ... 8 {
                let sizes = sizes(count, perCard: perCard)
                #expect(sizes.reduce(0, +) == count)
                #expect(sizes.allSatisfy { $0 <= perCard })
                #expect(sizes.allSatisfy { $0 >= 1 })
            }
        }
    }

    @Test func grammarNeverOverridesTheExplicitCount() {
        let words = ["I'll", "do", "the", "full", "cost", "versus", "revenue"]
        #expect(CaptionCardSizes.sizes(for: words, perCard: 3) == [3, 3, 1])
    }
}

/// A counted card holds its count through everything except the three things
/// that make a card impossible: another recording, a real stop, and a cut.
@MainActor
@Suite struct CaptionCountedGroupingTests {
    private let mediaID = UUID()

    private func words(_ count: Int, gap: Double = 0.05) -> [CaptionSourceWord] {
        var result: [CaptionSourceWord] = []
        var cursor = 0.0
        for index in 0 ..< count {
            // Every third word closes a sentence, which used to break the card.
            let text = index % 3 == 2 ? "word\(index)." : "word\(index)"
            result.append(
                CaptionSourceWord(
                    mediaID: mediaID,
                    text: text,
                    sourceStart: cursor,
                    sourceEnd: cursor + 0.25,
                    timelineStart: cursor,
                    timelineEnd: cursor + 0.25
                )
            )
            cursor += 0.25 + gap
        }
        return result
    }

    private func counts(_ captions: [ProjectCaption]) -> [Int] {
        captions.map { $0.text.split(whereSeparator: \.isWhitespace).count }
    }

    @Test func everyCardHoldsTheCount() {
        let cards = CaptionGenerator.captions(from: words(12), wordsPerCard: 3)
        #expect(counts(cards) == [3, 3, 3, 3])
    }

    /// A full stop mid-card is not a reason to cut the card short: in speech
    /// the pause is where the break belongs, and the pause is already a break.
    @Test func aSentenceEndingDoesNotBreakACountedCard() {
        let cards = CaptionGenerator.captions(from: words(10), wordsPerCard: 5)
        #expect(counts(cards) == [5, 5])
    }

    @Test func aSpokenPauseDoesNotOverrideTheExplicitCount() {
        var spoken = words(4)
        // A second of silence after the fourth word, then four more.
        var later = words(4)
        for index in later.indices {
            later[index].sourceStart += 3
            later[index].sourceEnd += 3
            later[index].timelineStart += 3
            later[index].timelineEnd += 3
        }
        spoken += later

        let cards = CaptionGenerator.captions(from: spoken, wordsPerCard: 3)

        #expect(counts(cards) == [3, 3, 2])
    }

    /// A card laid across a cut is anchored to seconds that are not in the edit
    /// any more, so it never appears at all. The run has to end there.
    @Test func aCutBreaksTheRun() {
        // The two halves play back to back but come from different clips, which
        // is what a cut is. The timings alone cannot say so: a transcriber's
        // word extents run together, so the removed seconds regularly sit
        // inside the words either side rather than in a gap between them.
        var spoken = words(3)
        for index in spoken.indices { spoken[index].clip = 0 ... 1 }
        var afterCut = words(3)
        for index in afterCut.indices {
            // Later in the recording, but immediately after in the edit.
            afterCut[index].sourceStart += 9
            afterCut[index].sourceEnd += 9
            afterCut[index].timelineStart += 1
            afterCut[index].timelineEnd += 1
            afterCut[index].clip = 9 ... 10
        }
        spoken += afterCut

        let cards = CaptionGenerator.captions(from: spoken, wordsPerCard: 4)

        #expect(counts(cards) == [3, 3])
    }
}

/// Changing how many words a card holds is about where the words break. It is
/// not a reason to throw away a card the creator has restyled.
@MainActor
@Suite struct CaptionRegroupingKeepsStyleTests {
    private let mediaID = UUID()

    private func project(wordsPerCard: Int) -> EditorProject {
        EditorProject(
            media: [ProjectMedia(
                id: mediaID,
                url: URL(filePath: "/tmp/regroup.mp4"),
                name: "regroup.mp4",
                duration: 8,
                width: 1080,
                height: 1920,
                hasAudio: true
            )],
            clips: [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 8)],
            transcript: (0 ..< 8).map { index in
                TranscriptWord(
                    mediaID: mediaID,
                    text: "word\(index)",
                    start: Double(index) * 0.3 + 0.1,
                    end: Double(index) * 0.3 + 0.25
                )
            },
            captionsEnabled: true,
            captionWordsPerCard: wordsPerCard
        )
    }

    /// Cutting one card into two gives both halves what the whole had.
    @Test func aCardSplitInTwoKeepsItsLookOnBothHalves() {
        var subject = project(wordsPerCard: 4)
        subject.regenerateCaptions()
        let first = subject.storedCaptions[0].id
        subject.applyCaptionStyle(
            TextStylePatch(y: 0.2, color: StudioColor(red: 1, green: 0, blue: 0)),
            applyToAll: false,
            selection: [first]
        )

        subject.setCaptionWordsPerCard(2)

        let opening = subject.storedCaptions.prefix(2)
        #expect(opening.count == 2)
        #expect(opening.allSatisfy { $0.overrides.y == 0.2 })
        #expect(opening.allSatisfy { $0.overrides.color != nil })
        // And the cards further along, which came out of a card that was never
        // restyled, are left alone.
        #expect(subject.storedCaptions.last?.overrides.y == nil)
    }

    /// Joining two into one takes the look of the earlier of them.
    @Test func aCardJoinedFromTwoTakesTheEarlierLook() {
        var subject = project(wordsPerCard: 2)
        subject.regenerateCaptions()
        let ids = subject.storedCaptions.map(\.id)
        subject.applyCaptionStyle(TextStylePatch(y: 0.11), applyToAll: false, selection: [ids[0]])
        subject.applyCaptionStyle(TextStylePatch(y: 0.99), applyToAll: false, selection: [ids[1]])

        subject.setCaptionWordsPerCard(4)

        #expect(subject.storedCaptions[0].overrides.y == 0.11)
    }

    /// Regenerate is the explicit "start over", and it still is.
    @Test func regenerateStillStartsClean() {
        var subject = project(wordsPerCard: 4)
        subject.regenerateCaptions()
        let first = subject.storedCaptions[0].id
        subject.applyCaptionStyle(TextStylePatch(y: 0.2), applyToAll: false, selection: [first])

        subject.regenerateCaptions()

        #expect(subject.storedCaptions.allSatisfy { $0.overrides.y == nil })
    }
}
