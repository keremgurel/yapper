@preconcurrency import AVFoundation
import Foundation
import Testing
@testable import YapperNative

/// Opt-in export for auditing ASR seams using the native PCM conversion,
/// chunk planner, and encoder. Makes no provider calls or project changes.
struct TranscriptionChunkExportDiagnostics {
    @Test("export native transcription chunks for a real-media audit")
    func export() throws {
        let environment = ProcessInfo.processInfo.environment
        guard let source = environment["ASR_AUDIT_MEDIA"],
              let destination = environment["ASR_AUDIT_OUTPUT"] else { return }
        let directory = URL(filePath: destination, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let file = try AVAudioFile(forReading: URL(filePath: source), commonFormat: .pcmFormatFloat32, interleaved: false)
        let format = file.processingFormat
        let channels = Int(format.channelCount)
        let buffer = try #require(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 32_768))
        var pcm = Data()
        while file.framePosition < file.length {
            try file.read(into: buffer, frameCount: buffer.frameCapacity)
            let channelData = try #require(buffer.floatChannelData)
            var mono = [Int16](repeating: 0, count: Int(buffer.frameLength))
            for frame in mono.indices {
                var sum: Float = 0
                for channel in 0 ..< channels { sum += channelData[channel][frame] }
                mono[frame] = TranscriptionPCM.monoSample(sum: sum, channelCount: channels).littleEndian
            }
            pcm.append(mono.withUnsafeBytes { Data($0) })
        }
        let rate = Int(format.sampleRate.rounded())
        let chunkSeconds = Double(environment["ASR_AUDIT_CHUNK_SECONDS"] ?? "120") ?? 120
        let overlapSeconds = Double(environment["ASR_AUDIT_OVERLAP_SECONDS"] ?? "30") ?? 30
        let chunks = TranscriptionChunkPlan.make(byteCount: pcm.count, sampleRate: rate, chunkSeconds: chunkSeconds, overlapSeconds: overlapSeconds)
        var manifest: [[String: Any]] = []
        for (index, chunk) in chunks.enumerated() {
            let name = "chunk-\(index).m4a"
            let output = directory.appending(path: name)
            try #require(!FileManager.default.fileExists(atPath: output.path))
            let data = try TranscriptionAudioEncoder.m4a(
                pcm: pcm.subdata(in: chunk.start ..< chunk.start + chunk.length), sampleRate: rate
            )
            try data.write(to: output)
            manifest.append(["file": name, "offset": chunk.offset, "duration": chunk.duration])
        }
        try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys])
            .write(to: directory.appending(path: "chunks.json"))
        print("Exported \(chunks.count) native chunks at \(rate) Hz from \(Double(pcm.count) / Double(rate * 2)) seconds")
    }
}
