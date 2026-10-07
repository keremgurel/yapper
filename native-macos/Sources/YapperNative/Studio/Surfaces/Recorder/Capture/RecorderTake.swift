@preconcurrency import AVFoundation

/// A finished take on disk, ready to review, save or download.
struct RecorderTake: Equatable, Identifiable {
    let id = UUID()
    let url: URL
    let mimeType: String
    let fileExtension: String
    let sizeBytes: Int
    var warning: String?
    var hasVideo = true
    var aspectRatio: Double = 16.0 / 9

    /// A timestamped name for Download, like the web's `yapper-take-...`.
    var suggestedFileName: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH-mm-ss"
        return "yapper-take-\(formatter.string(from: Date())).\(fileExtension)"
    }

    func discard() {
        try? FileManager.default.removeItem(at: url)
    }
}

/// Turns the capture's QuickTime file into an MP4 without re-encoding, so
/// the upload and the download are the same container the web recorder
/// prefers and the editor reads.
enum RecorderTakeFinisher {
    static func finish(_ movieURL: URL, framing: RecorderFraming = .auto) async -> RecorderTake? {
        let mp4 = movieURL.deletingPathExtension().appendingPathExtension("mp4")
        if await remux(movieURL, to: mp4, framing: framing) {
            try? FileManager.default.removeItem(at: movieURL)
            return await take(at: mp4, mimeType: "video/mp4", ext: "mp4")
        }
        // The QuickTime file is still a good take; keep it rather than lose it.
        var original = await take(at: movieURL, mimeType: "video/quicktime", ext: "mov")
        if framing != .auto { original?.warning = "The selected crop could not be saved. This is your original camera frame. Download it or crop it in the editor." }
        return original
    }

    private static func remux(_ source: URL, to destination: URL, framing: RecorderFraming) async -> Bool {
        try? FileManager.default.removeItem(at: destination)
        let asset = AVURLAsset(url: source)
        guard let session = AVAssetExportSession(asset: asset, presetName: framing == .auto ? AVAssetExportPresetPassthrough : AVAssetExportPresetHighestQuality) else {
            return false
        }
        do { session.videoComposition = try await framing.composition(for: asset) }
        catch { return false }
        session.shouldOptimizeForNetworkUse = true
        if #available(macOS 15, *) {
            do {
                try await session.export(to: destination, as: .mp4)
                return true
            } catch {
                return false
            }
        }
        session.outputURL = destination
        session.outputFileType = .mp4
        await session.export()
        return session.status == .completed
    }

    private static func take(at url: URL, mimeType: String, ext: String) async -> RecorderTake? {
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        guard size > 0 else { return nil }
        let track = try? await AVURLAsset(url: url).loadTracks(withMediaType: .video).first
        var ratio = 16.0 / 9
        if let track, let size = try? await track.load(.naturalSize), let transform = try? await track.load(.preferredTransform) {
            let bounds = CGRect(origin: .zero, size: size).applying(transform)
            ratio = abs(bounds.width) / max(1, abs(bounds.height))
        }
        return RecorderTake(url: url, mimeType: mimeType, fileExtension: ext, sizeBytes: size, hasVideo: track != nil, aspectRatio: ratio)
    }
}
