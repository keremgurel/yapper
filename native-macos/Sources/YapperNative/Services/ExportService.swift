@preconcurrency import AVFoundation
import Foundation

enum ExportService {
    static func export(project: EditorProject, to outputURL: URL) async throws {
        let built = try await CompositionBuilder.build(project: project)
        guard let session = AVAssetExportSession(
            asset: built.asset,
            presetName: AVAssetExportPresetHighestQuality
        ) else {
            throw NativeEditorError.exportFailed("AVAssetExportSession was unavailable.")
        }

        if FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.removeItem(at: outputURL)
        }
        session.videoComposition = built.videoComposition
        session.shouldOptimizeForNetworkUse = true
        try await session.export(to: outputURL, as: .mp4)

        let result = AVURLAsset(url: outputURL)
        let audioTracks = try await result.loadTracks(withMediaType: .audio)
        if project.media.contains(where: { $0.hasAudio }), audioTracks.isEmpty {
            try? FileManager.default.removeItem(at: outputURL)
            throw NativeEditorError.exportFailed(
                "The rendered file did not contain an audio track. Nothing was delivered."
            )
        }
    }
}
