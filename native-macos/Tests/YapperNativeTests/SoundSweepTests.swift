import Foundation
import Testing
@testable import YapperNative

/// "A mixture of pop, swoosh and camera shutter on every overlay." Nothing in
/// that needs a model, and asking one got it wrong in a way worth pinning down.
struct SoundSweepTests {
    @Test func theSentenceThatStartedThisIsAnsweredHere() {
        let sweep = SoundSweep.parse(
            "add a mixture of pop, swoosh and camera shutter sound effects aligned with every overlay we have."
        )
        #expect(sweep?.target == .overlays)
        #expect(sweep?.effects.map(\.id) == ["pop", "swoosh", "camera-shutter"])
    }

    /// The order they are named is the order they are dealt out, which is what
    /// makes a mixture a mixture rather than three sounds on one frame.
    @Test func effectsAreDealtRoundInTurn() {
        let sweep = try! #require(
            SoundSweep.parse("put a pop and a whoosh sound on every cut")
        )
        #expect(sweep.effect(at: 0).id == "pop")
        #expect(sweep.effect(at: 1).id == "whoosh")
        #expect(sweep.effect(at: 2).id == "pop")
        #expect(sweep.effect(at: 3).id == "whoosh")
    }

    @Test func oneEffectIsThatEffectEveryTime() {
        let sweep = try! #require(SoundSweep.parse("a pop sound on each overlay"))
        #expect(sweep.effects.map(\.id) == ["pop"])
        #expect(sweep.effect(at: 7).id == "pop")
    }

    @Test func cutsAreTheOtherThingWorthSweeping() {
        #expect(SoundSweep.parse("whoosh sound on every cut")?.target == .cuts)
        #expect(SoundSweep.parse("add a whoosh sound at every transition")?.target == .cuts)
    }

    /// A longer name wins: "camera shutter" is one effect, not a camera and a
    /// shutter, and the library has both a shutter snap and a camera shutter.
    @Test func theLongestNameWins() {
        let sweep = try! #require(
            SoundSweep.parse("camera shutter sound effect on every overlay")
        )
        #expect(sweep.effects.map(\.id) == ["camera-shutter"])
    }

    // MARK: - What it must not claim

    @Test func aSentenceAboutPlacingOverlaysIsNotASweep() {
        #expect(SoundSweep.parse("place every overlay where it fits") == nil)
        #expect(SoundSweep.parse("show all my b-roll") == nil)
    }

    @Test func aSoundForOneMomentIsNotASweep() {
        #expect(SoundSweep.parse("add a pop sound when I say Instagram") == nil)
    }

    @Test func aSoundWithNoTargetIsNotASweep() {
        #expect(SoundSweep.parse("add some sound effects") == nil)
    }

    @Test func aSweepOfNothingTheLibraryHasIsNotASweep() {
        #expect(SoundSweep.parse("put an airhorn sound on every overlay") == nil)
    }

    /// Naming no effect at all leaves a choice to be made, and choosing is what
    /// the model is for. Better it picks than this picks for it.
    @Test func aSweepThatNamesNoEffectIsLeftToTheModel() {
        #expect(SoundSweep.parse("add a sound effect at every transition") == nil)
        #expect(SoundSweep.parse("put some sound effects on every overlay") == nil)
    }
}

/// Where a sweep's sounds land.
@MainActor
struct SoundSweepPlacementTests {
    private func session(overlayStarts: [Double]) -> EditorSession {
        let mediaID = UUID()
        let session = EditorSession()
        session.updateProject { project in
            project = EditorProject(
                media: [
                    ProjectMedia(
                        id: mediaID,
                        url: URL(filePath: "/tmp/a.mov"),
                        name: "a",
                        duration: 60,
                        width: 1_080,
                        height: 1_920,
                        hasAudio: true
                    ),
                ],
                clips: [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 60)],
                overlays: overlayStarts.map {
                    ProjectOverlay(mediaID: mediaID, timelineStart: $0, duration: 2)
                }
            )
        }
        return session
    }

    @Test func oneSoundPerOverlay() {
        let session = session(overlayStarts: [4, 9, 15])
        let sweep = try! #require(
            SoundSweep.parse("pop and whoosh sound effects on every overlay")
        )
        let sounds = session.applySoundSweep(sweep)

        #expect(sounds.map(\.timelineStart) == [4, 9, 15])
        #expect(sounds.map(\.effect.id) == ["pop", "whoosh", "pop"])
    }

    @Test func overlaysAreTakenInTheOrderTheyAppear() {
        let session = session(overlayStarts: [15, 4, 9])
        let sweep = try! #require(SoundSweep.parse("a pop sound on every overlay"))
        #expect(session.applySoundSweep(sweep).map(\.timelineStart) == [4, 9, 15])
    }

    /// "Each time I show one of the email overlays" is about the email ones.
    @Test func asubsetNamedInTheSentenceIsTheSubsetSwept() {
        let session = EditorSession()
        let email = UUID()
        let chart = UUID()
        session.updateProject { project in
            project = EditorProject(
                media: [
                    ProjectMedia(
                        id: email,
                        url: URL(filePath: "/tmp/email-open-rate.png"),
                        name: "email-open-rate.png",
                        duration: 4,
                        width: 1_200,
                        height: 800,
                        hasAudio: false,
                        kind: .image
                    ),
                    ProjectMedia(
                        id: chart,
                        url: URL(filePath: "/tmp/daily-chart.png"),
                        name: "daily-chart.png",
                        duration: 4,
                        width: 1_200,
                        height: 800,
                        hasAudio: false,
                        kind: .image
                    ),
                ],
                clips: [TimelineClip(mediaID: UUID(), sourceStart: 0, sourceEnd: 60)],
                overlays: [
                    ProjectOverlay(mediaID: email, timelineStart: 2, duration: 2),
                    ProjectOverlay(mediaID: chart, timelineStart: 8, duration: 2),
                    ProjectOverlay(mediaID: email, timelineStart: 14, duration: 2),
                ]
            )
        }
        let instruction = "add a pop sound effect each time i show one of the email overlays"
        let sweep = try! #require(SoundSweep.parse(instruction))
        let sounds = session.applySoundSweep(sweep, instruction: instruction)

        #expect(sounds.map(\.timelineStart) == [2, 14])
    }

    @Test func aSentenceNamingNoFileSweepsThemAll() {
        let session = session(overlayStarts: [4, 9, 15])
        let instruction = "a pop sound on every overlay"
        let sweep = try! #require(SoundSweep.parse(instruction))
        #expect(session.applySoundSweep(sweep, instruction: instruction).count == 3)
    }

    @Test func aTimelineWithNoOverlaysGetsNoSoundsAndSaysWhy() {
        let session = session(overlayStarts: [])
        let sweep = try! #require(SoundSweep.parse("a pop sound on every overlay"))
        #expect(session.applySoundSweep(sweep).isEmpty)
        #expect(session.sweepEmptyReason(sweep).contains("no overlays"))
    }
}
