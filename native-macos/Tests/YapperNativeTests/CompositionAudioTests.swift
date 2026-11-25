@preconcurrency import AVFoundation
import Foundation
import Testing
@testable import YapperNative

/// A take whose sound stops before its picture: a check of the silent end
/// must not demand a sound track.
struct CompositionAudioTests {
    @Test func soundIsOnlyExpectedWhereTheTimelineHasIt() async throws {
        let url = FileManager.default.temporaryDirectory.appending(path: "tone-\(UUID()).wav")
        defer { try? FileManager.default.removeItem(at: url) }
        let format = try #require(AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1))
        let buffer = try #require(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 48000))
        buffer.frameLength = buffer.frameCapacity
        let samples = try #require(buffer.floatChannelData?[0])
        for index in 0..<Int(buffer.frameLength) { samples[index] = Float(0.3 * sin(Double(index) / 20)) }
        try AVAudioFile(forWriting: url, settings: format.settings).write(from: buffer)

        let source = AVURLAsset(url: url)
        let sourceTrack = try #require(try await source.loadTracks(withMediaType: .audio).first)
        let composition = AVMutableComposition()
        let track = try #require(composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid))
        let second = CMTime(value: 1, timescale: 1)
        try track.insertTimeRange(CMTimeRange(start: .zero, duration: second), of: sourceTrack, at: .zero)
        track.insertEmptyTimeRange(CMTimeRange(start: second, duration: CMTime(value: 4, timescale: 1)))

        let range = { (from: Double, to: Double) in
            CMTimeRange(start: CMTime(seconds: from, preferredTimescale: 600), end: CMTime(seconds: to, preferredTimescale: 600))
        }
        #expect(CompositionAudio.hasSound(in: composition, during: nil))
        #expect(CompositionAudio.hasSound(in: composition, during: range(0.2, 0.6)))
        #expect(!CompositionAudio.hasSound(in: composition, during: range(3, 4)))
    }
}
