@preconcurrency import AVFoundation
import Foundation

/// Compressed audio for the transcriber, from the mono PCM the decoder built.
///
/// The transcript route bills, rate limits, and size caps by the request, so
/// what matters is how few requests a take costs. Sixteen-bit PCM runs about
/// 96 kB a second, which turns a five minute take into thirty megabytes and a
/// dozen uploads; the same speech as AAC is roughly six kilobytes a second, so
/// the whole take fits in one request well inside the server's four megabyte
/// ceiling.
///
/// The sample rate is whatever came out of the file. Speech detail lives in the
/// onsets, and the resampling that a fixed rate would force is exactly what
/// used to smear them.
enum TranscriptionAudioEncoder {
    /// Bits per second for a single voice.
    ///
    /// Not a size knob. Measured against the untouched camera audio on a real
    /// take, transcription falls off a cliff below 64 kbps: 48 kbps returned
    /// 419 words and 56 kbps returned 425, against 476 for the original, and
    /// the words it loses are ordinary sentences. Worse than losing them, it
    /// invents: at 48 kbps the transcriber placed the word "go" across 0.8
    /// seconds of room tone 1.6 seconds before the speaker said it, which read
    /// downstream as a retake that never happened and cost the edit a real one.
    /// The original 72 kbps setting passed broad word-count checks but failed
    /// on tightly repeated takes: the app upload dropped the opening of a
    /// complete sentence while the same camera audio at higher fidelity heard
    /// both attempts. Stored chunks bypass the request-body ceiling, so there
    /// is no reason to balance speech accuracy on that cliff. 160 kbps keeps a
    /// three-minute chunk small while preserving substantially more onset and
    /// consonant detail for retake-heavy recordings.
    static let bitRate = 160_000

    static func m4a(pcm: Data, sampleRate: Int) throws -> Data {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("yapper-asr-\(UUID().uuidString)")
            .appendingPathExtension("m4a")
        defer { try? FileManager.default.removeItem(at: url) }
        try write(pcm: pcm, sampleRate: sampleRate, to: url)
        let encoded = try Data(contentsOf: url)
        guard !encoded.isEmpty else {
            throw NativeEditorError.aiFailed("The audio encoder produced nothing to send.")
        }
        return encoded
    }

    /// Kept in its own scope so the writer is closed, and the file finished,
    /// before anybody reads it back.
    private static func write(pcm: Data, sampleRate: Int, to url: URL) throws {
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: Double(sampleRate),
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: bitRate,
        ]
        guard
            let format = AVAudioFormat(
                commonFormat: .pcmFormatFloat32,
                sampleRate: Double(sampleRate),
                channels: 1,
                interleaved: false
            )
        else {
            throw NativeEditorError.aiFailed("The audio encoder could not describe the audio.")
        }
        let file = try AVAudioFile(forWriting: url, settings: settings)
        let frames = pcm.count / MemoryLayout<Int16>.stride
        var written = 0
        while written < frames {
            let count = min(16_384, frames - written)
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count)) else {
                throw NativeEditorError.aiFailed("The audio encoder could not allocate a buffer.")
            }
            buffer.frameLength = AVAudioFrameCount(count)
            guard let channel = buffer.floatChannelData?[0] else {
                throw NativeEditorError.aiFailed("The audio encoder could not reach its buffer.")
            }
            pcm.withUnsafeBytes { raw in
                let samples = raw.bindMemory(to: Int16.self)
                for frame in 0 ..< count {
                    channel[frame] = Float(Int16(littleEndian: samples[written + frame]))
                        / Float(Int16.max)
                }
            }
            try file.write(from: buffer)
            written += count
        }
    }
}
