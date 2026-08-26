@preconcurrency import AVFoundation
import Foundation
import Testing
@testable import YapperNative

/// One-click output may only keep stretches that the transcript can caption.
/// Waveform silence alone is not enough: a loud abandoned take can be missing
/// from ASR and used to survive as uncaptained speech.
@Suite
struct OneClickCaptionCoverageTests {
    private let mediaID = UUID()

    @Test("Loud audio with no transcript words is removed even when waveform silence was found")
    func removesUncaptionedLoudGap() async throws {
        let url = FileManager.default.temporaryDirectory
            .appending(path: "yapper-one-click-caption-coverage-\(UUID().uuidString).wav")
        defer { try? FileManager.default.removeItem(at: url) }
        try writeTake(to: url)

        let words = [
            TranscriptWord(mediaID: mediaID, text: "First.", start: 0.0, end: 0.4),
            TranscriptWord(mediaID: mediaID, text: "Second.", start: 2.6, end: 3.0),
        ]
        let ranges = try await AIEditService().autoEditRanges(
            words: words,
            duration: 3,
            aiCuts: [],
            url: url
        )

        #expect(
            ranges.contains { $0.0 < 1.5 && $0.1 > 1.5 },
            "loud audio with no word and therefore no caption must not survive one-click edit"
        )
        #expect(words.allSatisfy { word in
            !ranges.contains { $0.0 <= word.midpoint && word.midpoint <= $0.1 }
        })
    }

    /// Speech, a measured quiet patch, then more loud audio before the next
    /// transcribed word. The old implementation saw the quiet patch and kept
    /// the rest of the loud wordless gap.
    private func writeTake(to url: URL) throws {
        let sampleRate = 8_000.0
        let frames = Int(sampleRate * 3)
        let format = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: sampleRate,
            channels: 1,
            interleaved: false
        )!
        let buffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: AVAudioFrameCount(frames)
        )!
        buffer.frameLength = AVAudioFrameCount(frames)
        let samples = buffer.floatChannelData![0]
        for frame in 0 ..< frames {
            let time = Double(frame) / sampleRate
            let quiet = time >= 0.55 && time < 0.95
            samples[frame] = quiet ? 0 : Float(sin(2 * .pi * 220 * time) * 0.35)
        }
        let file = try AVAudioFile(forWriting: url, settings: format.settings)
        try file.write(from: buffer)
    }
}
