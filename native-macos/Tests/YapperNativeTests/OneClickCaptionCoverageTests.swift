@preconcurrency import AVFoundation
import Foundation
import Testing
@testable import YapperNative

/// Missing ASR words are not evidence that the audio is an abandoned take.
/// Speech coverage is verified before cleanup; trimming itself must never use
/// an untranscribed gap to authorize removal of audible content.
@Suite
struct OneClickCaptionCoverageTests {
    private let mediaID = UUID()

    @Test("Loud audio missing from ASR is preserved while measured silence is trimmed")
    func preservesUntranscribedLoudGap() async throws {
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
            !ranges.contains { $0.0 < 1.5 && $0.1 > 1.5 },
            "an ASR omission must never silently authorize cutting speech"
        )
        #expect(ranges.contains { $0.0 < 0.75 && $0.1 > 0.75 })
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
