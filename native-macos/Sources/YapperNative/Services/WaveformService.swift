@preconcurrency import AVFoundation
import Foundation

actor WaveformService {
    typealias Progress = @MainActor @Sendable (_ peaks: [Float], _ fraction: Double) -> Void

    private struct CachePayload: Codable {
        let fingerprint: String
        let peaks: [Float]
    }

    private var memoryCache: [String: [Float]] = [:]

    func peaks(
        for source: WaveformSource,
        targetBins requestedBins: Int? = nil,
        onProgress: Progress
    ) async throws -> [Float] {
        // Keep enough detail for the timeline's maximum zoom. A fixed bin count
        // made long recordings look like a few isolated needles.
        let targetBins = requestedBins ?? max(
            2_400,
            min(120_000, Int(ceil(source.duration * 96)))
        )
        let fingerprint = cacheFingerprint(for: source, targetBins: targetBins)
        if let cached = memoryCache[fingerprint] ?? loadCachedPeaks(for: source, fingerprint: fingerprint) {
            memoryCache[fingerprint] = cached
            await onProgress(cached, 1)
            return cached
        }

        let asset = AVURLAsset(url: source.url)
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
        defer {
            if reader.status == .reading { reader.cancelReading() }
        }

        let expectedSamples = max(1, Int(source.duration * sampleRate))
        let samplesPerBin = max(1, expectedSamples / max(1, targetBins))
        let progressInterval = max(512, targetBins / 24)
        var lastReportedPeakCount = 0
        var peaks: [Float] = []
        peaks.reserveCapacity(targetBins)
        var peak: Float = 0
        var inBin = 0

        while reader.status == .reading, let sampleBuffer = output.copyNextSampleBuffer() {
            try Task.checkCancellation()
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

            if peaks.count - lastReportedPeakCount >= progressInterval {
                lastReportedPeakCount = peaks.count
                await onProgress(
                    peaks,
                    min(0.99, Double(peaks.count) / Double(targetBins))
                )
            }
        }
        try Task.checkCancellation()
        if inBin > 0 { peaks.append(peak) }
        if reader.status == .failed {
            throw reader.error ?? NativeEditorError.exportFailed("Waveform decoding failed.")
        }
        memoryCache[fingerprint] = peaks
        saveCachedPeaks(peaks, for: source, fingerprint: fingerprint)
        await onProgress(peaks, 1)
        return peaks
    }

    private func cacheFingerprint(for source: WaveformSource, targetBins: Int) -> String {
        let attributes = try? FileManager.default.attributesOfItem(atPath: source.url.path)
        let size = (attributes?[.size] as? NSNumber)?.int64Value ?? 0
        let modified = (attributes?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        return "\(source.url.path)|\(size)|\(modified)|\(source.duration)|\(targetBins)"
    }

    private func cacheURL(for source: WaveformSource) -> URL? {
        guard let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return nil
        }
        let directory = base
            .appendingPathComponent("com.yapper.studio.native", isDirectory: true)
            .appendingPathComponent("Waveforms", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("\(source.key).plist")
    }

    private func loadCachedPeaks(for source: WaveformSource, fingerprint: String) -> [Float]? {
        guard let url = cacheURL(for: source),
              let data = try? Data(contentsOf: url),
              let payload = try? PropertyListDecoder().decode(CachePayload.self, from: data),
              payload.fingerprint == fingerprint
        else { return nil }
        return payload.peaks
    }

    private func saveCachedPeaks(_ peaks: [Float], for source: WaveformSource, fingerprint: String) {
        guard let url = cacheURL(for: source),
              let data = try? PropertyListEncoder().encode(
                  CachePayload(fingerprint: fingerprint, peaks: peaks)
              )
        else { return }
        try? data.write(to: url, options: .atomic)
    }
}
