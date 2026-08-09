import Foundation
import Testing
@testable import YapperNative

@Suite struct WaveformSourceTests {
    private func layer(
        _ path: String,
        timelineStart: Double = 0,
        duration: Double = 1,
        sourceStart: Double = 0,
        sourceDuration: Double? = nil
    ) -> ProjectAudioLayer {
        ProjectAudioLayer(
            url: URL(fileURLWithPath: path),
            name: "Whoosh",
            timelineStart: timelineStart,
            duration: duration,
            sourceStart: sourceStart,
            sourceDuration: sourceDuration
        )
    }

    @Test func theSameSoundPlacedTwiceIsMeasuredOnce() {
        let first = WaveformSource(audio: layer("/Sounds/whoosh.m4a", timelineStart: 2))
        let second = WaveformSource(audio: layer("/Sounds/whoosh.m4a", timelineStart: 9))
        let other = WaveformSource(audio: layer("/Sounds/pop.m4a"))

        #expect(first.key == second.key)
        #expect(first.key != other.key)
    }

    @Test func theKeyIsTheSameAcrossLaunches() {
        // Not `hashValue`, which is seeded per process: a key that changed on
        // relaunch would throw away yesterday's cached waveform every morning.
        #expect(
            WaveformSource.fileKey(for: URL(fileURLWithPath: "/Sounds/whoosh.m4a")) == "3v6wwha6q1qab"
        )
        #expect(WaveformSource.fileKey(for: URL(fileURLWithPath: "/Sounds/whoosh.m4a"))
            == WaveformSource.fileKey(for: URL(fileURLWithPath: "/Sounds//whoosh.m4a")))
    }

    @Test func theWholeFileIsMeasuredHoweverLittleOfItIsUsed() {
        // Trimmed to half a second out of a three second riser: pulling the
        // handle back out must not wait for a second decode.
        let source = WaveformSource(
            audio: layer("/Sounds/riser.m4a", duration: 0.5, sourceStart: 0.2, sourceDuration: 3)
        )
        #expect(source.duration == 3)
    }

    /// The shipped effects are what the audio track is mostly made of, so the
    /// path from a bundled file to drawable bars is worth proving on a real
    /// one rather than only on arithmetic.
    @Test func aShippedSoundEffectDecodesIntoBars() async throws {
        let effect = try #require(SoundEffectDescriptor.library.first { $0.id == "pop" })
        let url = try #require(SoundEffectService.shared.bundledURL(for: effect))
        let peaks = try await WaveformService().peaks(
            for: WaveformSource(key: "test-pop", url: url, duration: effect.duration),
            targetBins: 600
        ) { _, _ in }

        #expect(peaks.count > 100)
        #expect(peaks.contains { $0 > 0.05 })
    }

    @Test func anEffectWithNoStatedLengthStillCoversWhatItPlays() {
        let source = WaveformSource(
            audio: layer("/Sounds/riser.m4a", duration: 1.4, sourceStart: 0.6)
        )
        #expect(source.duration == 2)
    }
}
