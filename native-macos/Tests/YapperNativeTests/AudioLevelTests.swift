import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// The one range the fader, the mix and the waveform all have to agree on.
struct AudioLevelTests {
    @Test func aLevelIsHeldInsideWhatTheMixWillHonour() {
        #expect(AudioLevel.clamped(-3) == AudioLevel.minimum)
        #expect(AudioLevel.clamped(9) == AudioLevel.maximum)
        #expect(AudioLevel.clamped(0.4) == 0.4)
        #expect(AudioLevel.clamped(.nan) == AudioLevel.unity)
    }

    @Test func theReadoutIsTheNumberPeopleSay() {
        #expect(AudioLevel.percent(0.5) == 50)
        #expect(AudioLevel.percent(1) == 100)
        #expect(AudioLevel.percent(1.755) == 176)
    }

    /// Below unity a waveform is drawn exactly as loud as it plays. Above it,
    /// the bars have nowhere to grow: a row is only so tall.
    @Test func theWaveformSaturatesRatherThanOverflowingItsRow() {
        #expect(AudioLevel.waveformGain(0.3) == 0.3)
        #expect(AudioLevel.waveformGain(1) == 1)
        #expect(AudioLevel.waveformGain(1.8) == 1)
    }
}

/// What the timeline draws at a given level.
struct WaveformGainTests {
    private let peaks: [Float] = Array(repeating: 1, count: 64)
    private let size = CGSize(width: 100, height: 40)

    private func tallest(gain: Double) -> CGFloat {
        WaveformBars
            .rects(peaks: peaks, sampleRange: 0 ..< peaks.count, size: size, gain: gain)
            .map(\.height)
            .max() ?? 0
    }

    @Test func pullingTheFaderDownShortensTheBars() {
        #expect(tallest(gain: 0.5) < tallest(gain: 1))
        #expect(tallest(gain: 0.1) < tallest(gain: 0.5))
    }

    /// Silence is a flat line rather than an empty cell: a cell that went blank
    /// would read as a clip with no audio at all.
    @Test func silenceIsStillDrawn() {
        let rects = WaveformBars.rects(
            peaks: peaks,
            sampleRange: 0 ..< peaks.count,
            size: size,
            gain: 0
        )
        #expect(!rects.isEmpty)
        #expect(rects.allSatisfy { $0.height <= 2 })
    }

    @Test func barsStayInsideTheirCell() {
        for gain in [0.0, 0.5, 1.0] {
            let rects = WaveformBars.rects(
                peaks: peaks,
                sampleRange: 0 ..< peaks.count,
                size: size,
                gain: gain
            )
            #expect(rects.allSatisfy { $0.minY >= 0 && $0.maxY <= size.height })
        }
    }

    @Test func aWaveformWithNoFaderIsDrawnExactlyAsItAlwaysWas() {
        let withDefault = WaveformBars.rects(peaks: peaks, sampleRange: 0 ..< peaks.count, size: size)
        let explicitly = WaveformBars.rects(
            peaks: peaks,
            sampleRange: 0 ..< peaks.count,
            size: size,
            gain: 1
        )
        #expect(withDefault == explicitly)
    }
}

/// A fader is dragged, and the project must not hear about every step of it.
@MainActor
struct AudioLevelDraftTests {
    @Test func aDraftBelongsOnlyToTheFaderBeingDragged() {
        let draft = AudioLevelDraft()
        let id = UUID()
        draft.set(0.4, for: id)

        #expect(draft.volume(for: id) == 0.4)
        #expect(draft.volume(for: UUID()) == nil)
    }

    @Test func endingHandsBackTheLastValueAndForgetsIt() {
        let draft = AudioLevelDraft()
        let id = UUID()
        draft.set(0.2, for: id)
        draft.set(0.8, for: id)

        #expect(draft.endLayer()?.volume == 0.8)
        #expect(draft.pending == nil)
        #expect(draft.endLayer() == nil)
    }

    @Test func theMainTrackHasItsOwnFader() {
        let draft = AudioLevelDraft()
        draft.setMainTrack(0.25)
        #expect(draft.mainTrack == 0.25)
        #expect(draft.endMainTrack() == 0.25)
        #expect(draft.mainTrack == nil)
    }

    @Test func aDraftIsHeldInRangeLikeAnythingElse() {
        let draft = AudioLevelDraft()
        draft.setMainTrack(50)
        #expect(draft.mainTrack == AudioLevel.maximum)
    }
}

/// Muting and a fader mean different things and both have to survive.
struct VideoTrackVolumeTests {
    /// One project, copied per test: built fresh each time it would mint new
    /// identifiers, and two projects whose clips are different clips rightly
    /// differ by more than a fader.
    private let base = EditorProject(
        clips: [TimelineClip(mediaID: UUID(), sourceStart: 0, sourceEnd: 4)]
    )
    private var project: EditorProject { base }

    @Test func aProjectSavedBeforeFadersExistedPlaysAtFullVolume() {
        #expect(project.resolvedVideoTrackVolume == AudioLevel.unity)
    }

    @Test func mutingWinsOverWhateverTheFaderSays() {
        var muted = project
        muted.videoTrackVolume = 0.8
        muted.videoTrackMuted = true
        #expect(muted.resolvedVideoTrackVolume == 0)
        // And the fader is remembered, so unmuting goes back to where it was.
        #expect(muted.videoTrackVolume == 0.8)
    }

    @Test func aFaderChangeIsSomethingThePlayerCanBeReDressedFor() {
        var quieter = project
        quieter.videoTrackVolume = 0.4
        #expect(quieter.differsOnlyInPresentation(from: project))
    }

    @Test func aLayerFaderChangeIsToo() {
        var withAudio = project
        withAudio.audioLayers = [
            ProjectAudioLayer(
                url: URL(filePath: "/tmp/pop.wav"),
                name: "pop",
                timelineStart: 1,
                duration: 0.3
            ),
        ]
        var quieter = withAudio
        quieter.audioLayers?[0].volume = 0.3
        #expect(quieter.differsOnlyInPresentation(from: withAudio))
    }

    @Test func movingASoundIsNotAFaderChange() {
        var withAudio = project
        withAudio.audioLayers = [
            ProjectAudioLayer(
                url: URL(filePath: "/tmp/pop.wav"),
                name: "pop",
                timelineStart: 1,
                duration: 0.3
            ),
        ]
        var moved = withAudio
        moved.audioLayers?[0].timelineStart = 2
        #expect(!moved.differsOnlyInPresentation(from: withAudio))
    }

    @Test func addingASoundIsNotAFaderChange() {
        var withAudio = project
        withAudio.audioLayers = [
            ProjectAudioLayer(
                url: URL(filePath: "/tmp/pop.wav"),
                name: "pop",
                timelineStart: 1,
                duration: 0.3
            ),
        ]
        #expect(!withAudio.differsOnlyInPresentation(from: project))
    }
}
