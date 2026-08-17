import AVFoundation
import Foundation
import Testing
@testable import YapperNative

/// What gets sent to the transcriber.
///
/// The size is the point. The route bills a credit and spends a rate limit
/// token per request, so a take that arrives as raw PCM costs a dozen of each
/// and gets refused halfway through. Compressed, the same speech is one small
/// request.
@Suite
struct TranscriptionAudioEncoderTests {
    private func speech(seconds: Double, sampleRate: Int) -> Data {
        let frames = Int(seconds * Double(sampleRate))
        var samples = [Int16](repeating: 0, count: frames)
        for frame in 0 ..< frames {
            let tone = sin(Double(frame) / Double(sampleRate) * 2 * .pi * 220)
            samples[frame] = Int16(tone * 12_000).littleEndian
        }
        return samples.withUnsafeBytes { Data($0) }
    }

    @Test("A minute of speech fits in a request many times over")
    func compresses() throws {
        let sampleRate = 48_000
        let pcm = speech(seconds: 60, sampleRate: sampleRate)
        let encoded = try TranscriptionAudioEncoder.m4a(pcm: pcm, sampleRate: sampleRate)
        #expect(!encoded.isEmpty)
        // Raw would be 5.7 MB. The server refuses anything over four.
        #expect(encoded.count < 600_000)
        #expect(encoded.count * 8 < pcm.count)
    }

    @Test("The encoded audio still plays back at its own rate and length")
    func survivesTheRoundTrip() throws {
        let sampleRate = 48_000
        let pcm = speech(seconds: 3, sampleRate: sampleRate)
        let encoded = try TranscriptionAudioEncoder.m4a(pcm: pcm, sampleRate: sampleRate)

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("encoder-test-\(UUID().uuidString)")
            .appendingPathExtension("m4a")
        try encoded.write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }

        let file = try AVAudioFile(forReading: url)
        #expect(file.fileFormat.channelCount == 1)
        #expect(abs(file.fileFormat.sampleRate - Double(sampleRate)) < 1)
        let seconds = Double(file.length) / file.fileFormat.sampleRate
        // AAC pads its first and last packet; the take must not lose speech.
        #expect(seconds >= 3)
        #expect(seconds < 3.3)
    }

    @Test("A take recorded at another rate keeps that rate")
    func keepsTheSourceRate() throws {
        let encoded = try TranscriptionAudioEncoder.m4a(
            pcm: speech(seconds: 1, sampleRate: 44_100),
            sampleRate: 44_100
        )
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("encoder-rate-\(UUID().uuidString)")
            .appendingPathExtension("m4a")
        try encoded.write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }
        let file = try AVAudioFile(forReading: url)
        #expect(abs(file.fileFormat.sampleRate - 44_100) < 1)
    }
}
