@preconcurrency import AVFoundation
import Foundation

private final class ExportSessionCancellation: @unchecked Sendable {
    private let session: AVAssetExportSession

    init(_ session: AVAssetExportSession) {
        self.session = session
    }

    func cancel() {
        session.cancelExport()
    }
}

enum ExportService {
    static func export(project: EditorProject, to outputURL: URL) async throws {
        let snapshot = try await ExportSourceSnapshot.create(project: project)
        defer { snapshot.discard() }

        // Everything, including the captions and the text: this is the one that
        // has to look like the finished video, because it is.
        let built = try await CompositionBuilder.build(project: snapshot.project, for: .export)
        guard let session = AVAssetExportSession(
            asset: built.asset,
            presetName: AVAssetExportPresetHighestQuality
        ) else {
            throw NativeEditorError.exportFailed("AVAssetExportSession was unavailable.")
        }

        session.videoComposition = built.videoComposition
        session.audioMix = built.audioMix
        session.shouldOptimizeForNetworkUse = true
        let cancellation = ExportSessionCancellation(session)

        let expectedDuration = CMTimeGetSeconds(try await built.asset.load(.duration))
        let durationTolerance = max(
            0.25,
            (built.videoComposition?.frameDuration.seconds ?? 1.0 / 30.0) * 2
        )

        try await StagedFileDelivery.deliver(
            to: outputURL,
            produce: { stagedURL in
                try await withTaskCancellationHandler {
                    try await session.export(to: stagedURL, as: .mp4)
                } onCancel: {
                    cancellation.cancel()
                }
            },
            validate: { stagedURL in
                let values = try stagedURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
                guard values.isRegularFile == true, (values.fileSize ?? 0) > 0 else {
                    throw NativeEditorError.exportFailed(
                        "The rendered file was empty. Nothing was delivered."
                    )
                }

                let result = AVURLAsset(url: stagedURL)
                let duration = try await result.load(.duration)
                let playable = try await result.load(.isPlayable)
                let videoTracks = try await result.loadTracks(withMediaType: .video)
                let durationSeconds = CMTimeGetSeconds(duration)
                guard playable,
                      !videoTracks.isEmpty,
                      durationSeconds.isFinite,
                      durationSeconds > 0,
                      abs(durationSeconds - expectedDuration) <= durationTolerance else {
                    throw NativeEditorError.exportFailed(
                        "The rendered file did not contain readable video. Nothing was delivered."
                    )
                }

                let audioTracks = try await result.loadTracks(withMediaType: .audio)
                var containsAudio = false
                for track in audioTracks {
                    let timeRange = try await track.load(.timeRange)
                    if CMTimeGetSeconds(timeRange.duration) > 0 {
                        containsAudio = true
                        break
                    }
                }
                if built.hasRenderedAudio, !containsAudio {
                    throw NativeEditorError.exportFailed(
                        "The rendered file did not contain an audio track. Nothing was delivered."
                    )
                }
            }
        )
    }
}
