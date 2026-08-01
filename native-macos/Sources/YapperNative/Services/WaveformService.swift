@preconcurrency import AVFoundation
import Foundation

actor WaveformService {
    typealias Progress = @MainActor @Sendable (_ peaks: [Float], _ fraction: Double) -> Void

    func peaks(
        for media: ProjectMedia,
        targetBins: Int = 1_600,
        onProgress: Progress
    ) async throws -> [Float] {
        let asset = AVURLAsset(url: media.url)
        let tracks = try await asset.loadTracks(withMediaType: .audio)
        guard let track = tracks.first else {
            await onProgress([], 1)
            return []
        }

        let reader = try AVAssetReader(asset: asset)
        let sampleRate = 44_100.0
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [
                AVFormatIDKey: kAudioFormatLinearPCM,
                AVSampleRateKey: sampleRate,
                AVNumberOfChannelsKey: 1,
                AVLinearPCMBitDepthKey: 32,
                AVLinearPCMIsFloatKey: true,
                AVLinearPCMIsBigEndianKey: false,
                AVLinearPCMIsNonInterleaved: false,
            ]
        )
        output.alwaysCopiesSampleData = false
        guard reader.canAdd(output) else {
            throw NativeEditorError.exportFailed("Could not decode audio for its waveform.")
        }
        reader.add(output)
        guard reader.startReading() else {
            throw reader.error ?? NativeEditorError.exportFailed("Waveform decoding did not start.")
        }

        let expectedSamples = max(1, Int(media.duration * sampleRate))
        let samplesPerBin = max(1, expectedSamples / max(1, targetBins))
        var peaks: [Float] = []
        peaks.reserveCapacity(targetBins)
        var peak: Float = 0
        var inBin = 0

        while reader.status == .reading, let sampleBuffer = output.copyNextSampleBuffer() {
            guard let block = CMSampleBufferGetDataBuffer(sampleBuffer) else { continue }
            let byteCount = CMBlockBufferGetDataLength(block)
            var bytes = Data(count: byteCount)
            let copyStatus = bytes.withUnsafeMutableBytes { rawBuffer in
                guard let base = rawBuffer.baseAddress else { return kCMBlockBufferBadCustomBlockSourceErr }
                return CMBlockBufferCopyDataBytes(
                    block,
                    atOffset: 0,
                    dataLength: byteCount,
                    destination: base
                )
            }
            guard copyStatus == kCMBlockBufferNoErr else { continue }

            bytes.withUnsafeBytes { rawBuffer in
                let samples = rawBuffer.bindMemory(to: Float.self)
                for sample in samples {
                    peak = max(peak, min(1, abs(sample)))
                    inBin += 1
                    if inBin >= samplesPerBin {
                        peaks.append(peak)
                        peak = 0
                        inBin = 0
                    }
                }
            }

            if peaks.count.isMultiple(of: 64), !peaks.isEmpty {
                await onProgress(
                    peaks,
                    min(0.99, Double(peaks.count) / Double(targetBins))
                )
            }
        }
        if inBin > 0 { peaks.append(peak) }
        if reader.status == .failed {
            throw reader.error ?? NativeEditorError.exportFailed("Waveform decoding failed.")
        }
        await onProgress(peaks, 1)
        return peaks
    }
}
