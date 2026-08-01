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
        for media: ProjectMedia,
        targetBins requestedBins: Int? = nil,
        onProgress: Progress
    ) async throws -> [Float] {
        // Keep enough detail for the timeline's maximum zoom. A fixed bin count
        // made long recordings look like a few isolated needles.
        let targetBins = requestedBins ?? max(
            2_400,
            min(120_000, Int(ceil(media.duration * 96)))
        )
        let fingerprint = cacheFingerprint(for: media, targetBins: targetBins)
        if let cached = memoryCache[fingerprint] ?? loadCachedPeaks(for: media, fingerprint: fingerprint) {
            memoryCache[fingerprint] = cached
            await onProgress(cached, 1)
            return cached
        }

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
        let progressInterval = max(512, targetBins / 24)
        var lastReportedPeakCount = 0
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

            if peaks.count - lastReportedPeakCount >= progressInterval {
                lastReportedPeakCount = peaks.count
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
        memoryCache[fingerprint] = peaks
        saveCachedPeaks(peaks, for: media, fingerprint: fingerprint)
        await onProgress(peaks, 1)
        return peaks
    }

    private func cacheFingerprint(for media: ProjectMedia, targetBins: Int) -> String {
        let attributes = try? FileManager.default.attributesOfItem(atPath: media.url.path)
        let size = (attributes?[.size] as? NSNumber)?.int64Value ?? 0
        let modified = (attributes?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        return "\(media.url.path)|\(size)|\(modified)|\(media.duration)|\(targetBins)"
    }

    private func cacheURL(for media: ProjectMedia) -> URL? {
        guard let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return nil
        }
        let directory = base
            .appendingPathComponent("com.yapper.studio.native", isDirectory: true)
            .appendingPathComponent("Waveforms", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("\(media.id.uuidString).plist")
    }

    private func loadCachedPeaks(for media: ProjectMedia, fingerprint: String) -> [Float]? {
        guard let url = cacheURL(for: media),
              let data = try? Data(contentsOf: url),
              let payload = try? PropertyListDecoder().decode(CachePayload.self, from: data),
              payload.fingerprint == fingerprint
        else { return nil }
        return payload.peaks
    }

    private func saveCachedPeaks(_ peaks: [Float], for media: ProjectMedia, fingerprint: String) {
        guard let url = cacheURL(for: media),
              let data = try? PropertyListEncoder().encode(
                  CachePayload(fingerprint: fingerprint, peaks: peaks)
              )
        else { return }
        try? data.write(to: url, options: .atomic)
    }
}
