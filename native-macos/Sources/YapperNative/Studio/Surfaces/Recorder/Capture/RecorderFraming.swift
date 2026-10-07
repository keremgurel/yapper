@preconcurrency import AVFoundation

/// Auto preserves the camera frame. Explicit ratios center-crop both preview and output.
enum RecorderFraming: String, Codable, CaseIterable, Sendable {
    case auto, landscape, portrait
    var label: String {
        switch self { case .auto: "Auto"; case .landscape: "16:9"; case .portrait: "9:16" }
    }
    func ratio(source: Double) -> Double {
        switch self { case .auto: source; case .landscape: 16.0 / 9; case .portrait: 9.0 / 16 }
    }
    static func cropSize(source: CGSize, ratio: Double) -> CGSize {
        let width = min(source.width, source.height * ratio)
        let height = min(source.height, source.width / ratio)
        return CGSize(width: max(2, floor(width / 2) * 2), height: max(2, floor(height / 2) * 2))
    }
    func composition(for asset: AVAsset) async throws -> AVMutableVideoComposition? {
        guard self != .auto, let track = try await asset.loadTracks(withMediaType: .video).first else { return nil }
        let natural = try await track.load(.naturalSize)
        let preferred = try await track.load(.preferredTransform)
        let bounds = CGRect(origin: .zero, size: natural).applying(preferred)
        let source = CGSize(width: abs(bounds.width), height: abs(bounds.height))
        let output = Self.cropSize(source: source, ratio: ratio(source: source.width / source.height))
        let transform = preferred.concatenating(CGAffineTransform(
            translationX: -bounds.minX - (source.width - output.width) / 2,
            y: -bounds.minY - (source.height - output.height) / 2
        ))
        let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: track)
        layer.setTransform(transform, at: .zero)
        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = CMTimeRange(start: .zero, duration: try await asset.load(.duration))
        instruction.layerInstructions = [layer]
        let composition = AVMutableVideoComposition()
        composition.renderSize = output
        let fps = try await track.load(.nominalFrameRate)
        composition.frameDuration = CMTime(value: 1, timescale: Int32(max(1, fps.rounded())))
        composition.instructions = [instruction]
        return composition
    }
}
