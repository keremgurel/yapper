import Foundation
import Testing
@testable import YapperNative

/// Sounds that overlap in time must not overlap on screen: a pop landing in the
/// middle of a drum roll was drawn on top of it, and came out as a sliver you
/// could neither read nor grab.
struct AudioTracksTests {
    private func sound(at start: Double, for duration: Double) -> ProjectAudioLayer {
        ProjectAudioLayer(
            url: URL(filePath: "/tmp/pop.wav"),
            name: "pop",
            timelineStart: start,
            duration: duration
        )
    }

    @Test func soundsThatNeverOverlapShareOneLane() {
        let layers = [sound(at: 0, for: 1), sound(at: 2, for: 1), sound(at: 4, for: 1)]
        let lanes = AudioTracks.lanes(for: layers)
        #expect(lanes.values.allSatisfy { $0 == 0 })
        #expect(AudioTracks.count(for: layers) == 1)
    }

    @Test func aSoundInsideAnotherGoesBelowIt() {
        let roll = sound(at: 0, for: 4)
        let pop = sound(at: 1, for: 0.3)
        let lanes = AudioTracks.lanes(for: [roll, pop])
        #expect(lanes[roll.id] == 0)
        #expect(lanes[pop.id] == 1)
        #expect(AudioTracks.count(for: [roll, pop]) == 2)
    }

    @Test func threeAtOnceTakeThreeLanes() {
        let layers = [sound(at: 0, for: 5), sound(at: 1, for: 5), sound(at: 2, for: 5)]
        #expect(Set(AudioTracks.lanes(for: layers).values) == [0, 1, 2])
    }

    /// A lane is taken back the moment the sound holding it has finished, so a
    /// long run of sounds does not march down the screen.
    @Test func aLaneIsReusedOnceItIsFree() {
        let roll = sound(at: 0, for: 4)
        let pop = sound(at: 1, for: 0.3)
        let later = sound(at: 2, for: 0.3)
        let lanes = AudioTracks.lanes(for: [roll, pop, later])
        #expect(lanes[pop.id] == 1)
        #expect(lanes[later.id] == 1)
    }

    @Test func aSoundStartingWhereAnotherEndsIsNotAnOverlap() {
        let first = sound(at: 0, for: 1)
        let second = sound(at: 1, for: 1)
        let lanes = AudioTracks.lanes(for: [first, second])
        #expect(lanes[second.id] == 0)
    }

    /// The order they are stored in is whatever order they were added; the
    /// order they are heard is what decides the lanes.
    @Test func lanesFollowTheOrderTheyAreHeard() {
        let late = sound(at: 5, for: 4)
        let early = sound(at: 0, for: 6)
        let lanes = AudioTracks.lanes(for: [late, early])
        #expect(lanes[early.id] == 0)
        #expect(lanes[late.id] == 1)
    }

    @Test func nothingOnTheTrackIsNoLanesAtAll() {
        #expect(AudioTracks.count(for: []) == 0)
        #expect(AudioTracks.lanes(for: []).isEmpty)
    }
}

/// Naming files in the middle of a sentence, without an `@`.
struct MediaNameMatchTests {
    private let names = [
        "email-open-rate.png",
        "email-clicks.png",
        "daily-metrics-going-up.png",
        "visitor-breakdown.mov",
    ]

    @Test func aWordSharedWithAFileNameNamesThatFile() {
        let matched = MediaNameMatch.mentioned(
            in: "add a pop sound effect each time i show one of the email overlays",
            names: names
        )
        #expect(matched == ["email-open-rate.png", "email-clicks.png"])
    }

    @Test func aSentenceThatNamesNothingMatchesNothing() {
        #expect(
            MediaNameMatch.mentioned(in: "add a pop sound on every overlay", names: names).isEmpty
        )
    }

    /// The words these sentences are made of must not match by accident, or
    /// every file with "video" or "clip" in its name would be claimed.
    @Test func theWordsEverySentenceContainsAreIgnored() {
        #expect(
            MediaNameMatch.mentioned(in: "show the overlays and add sound", names: names).isEmpty
        )
        #expect(
            MediaNameMatch.mentioned(in: "a sound on each clip", names: ["clip-one.mov"]).isEmpty
        )
    }

    @Test func shortWordsAreNotEnoughToNameAFile() {
        #expect(MediaNameMatch.mentioned(in: "up and to it", names: names).isEmpty)
    }
}
