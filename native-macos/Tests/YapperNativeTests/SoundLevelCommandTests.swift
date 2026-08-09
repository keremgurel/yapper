import Foundation
import Testing
@testable import YapperNative

/// "Make all the pops 80%." Which sounds, and how loud.
struct SoundLevelCommandTests {
    @Test func aNamedEffectIsSetOnItsOwn() {
        let command = SoundLevelCommand.parse("make all pop sound effects have 80% volume")
        #expect(command?.target == .effect("pop"))
        #expect(command?.volume == 0.8)
    }

    @Test func everySoundIsSetTogether() {
        let command = SoundLevelCommand.parse("make all sound effects we have 50% volume")
        #expect(command?.target == .allSounds)
        #expect(command?.volume == 0.5)
    }

    @Test func theSpeakersOwnTrackHasItsOwnFader() {
        #expect(
            SoundLevelCommand.parse("set the video volume to 70%")?.target == .videoTrack
        )
    }

    /// Two-word names are matched whole, or "camera shutter" would be found by
    /// a sentence about a camera.
    @Test func aTwoWordEffectIsMatchedWhole() {
        #expect(
            SoundLevelCommand.parse("make every camera shutter 40% volume")?.target
                == .effect("camera-shutter")
        )
    }

    @Test func aWordThatMerelyContainsAnEffectIsNotOne() {
        // "popular" is not a pop, so this is every sound rather than the pops.
        #expect(
            SoundLevelCommand.parse("make all the popular sound effects 60% volume")?.target
                == .allSounds
        )
    }

    // MARK: - What it must not claim

    @Test func aSentenceWithNoLevelInItIsNotThis() {
        #expect(SoundLevelCommand.parse("add a pop to every overlay") == nil)
        #expect(SoundLevelCommand.parse("make all the pops louder") == nil)
    }

    @Test func aSentenceWithNoNumberIsNotThis() {
        #expect(SoundLevelCommand.parse("turn the volume of all sounds down") == nil)
    }

    /// A level this cannot reach is refused rather than quietly clamped:
    /// somebody who typed 800 meant something, and 200 is not it.
    @Test func aLevelPastWhatTheMixWillDoIsRefused() {
        #expect(SoundLevelCommand.parse("make all sound effects 800% volume") == nil)
        #expect(SoundLevelCommand.parse("make all sound effects 200% volume")?.volume == 2)
    }

    @Test func silenceIsALevelLikeAnyOther() {
        #expect(SoundLevelCommand.parse("make every pop 0% volume")?.volume == 0)
    }
}

/// Setting those levels, on the layers it named.
@MainActor
struct SoundLevelCommandApplyTests {
    private func session() -> EditorSession {
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
                audioLayers: [
                    ProjectAudioLayer(
                        url: URL(filePath: "/tmp/pop.wav"),
                        name: "Pop",
                        timelineStart: 1,
                        duration: 0.3,
                        builtInID: "pop"
                    ),
                    ProjectAudioLayer(
                        url: URL(filePath: "/tmp/whoosh.wav"),
                        name: "Whoosh",
                        timelineStart: 5,
                        duration: 0.3,
                        builtInID: "whoosh"
                    ),
                    ProjectAudioLayer(
                        url: URL(filePath: "/tmp/pop.wav"),
                        name: "Pop",
                        timelineStart: 9,
                        duration: 0.3,
                        builtInID: "pop"
                    ),
                ]
            )
        }
        return session
    }

    @Test func onlyTheNamedEffectIsChanged() {
        let session = session()
        let command = try! #require(
            SoundLevelCommand.parse("make all pop sound effects have 80% volume")
        )
        let notes = session.applyLevelCommand(command)

        let layers = session.project.audioLayers ?? []
        #expect(layers.filter { $0.builtInID == "pop" }.allSatisfy { $0.volume == 0.8 })
        #expect(layers.first { $0.builtInID == "whoosh" }?.volume == 1)
        #expect(notes.count == 1)
    }

    @Test func everySoundIsChangedTogether() {
        let session = session()
        let command = try! #require(
            SoundLevelCommand.parse("make all sound effects 50% volume")
        )
        session.applyLevelCommand(command)
        #expect((session.project.audioLayers ?? []).allSatisfy { $0.volume == 0.5 })
    }

    @Test func namingASoundThisTimelineDoesNotHaveChangesNothingAndSaysSo() {
        let session = session()
        let command = try! #require(
            SoundLevelCommand.parse("make every drum roll 30% volume")
        )
        #expect(session.applyLevelCommand(command).isEmpty)
        #expect(session.levelCommandEmptyReason(command).contains("Drum roll"))
        #expect((session.project.audioLayers ?? []).allSatisfy { $0.volume == 1 })
    }
}
