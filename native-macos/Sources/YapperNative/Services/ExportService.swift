@preconcurrency import AVFoundation
import Foundation

private final class ExportSessionCancellation: @unchecked Sendable {
    private let lock = NSLock()
    private var session: AVAssetExportSession?

    func use(_ session: AVAssetExportSession) {
        lock.withLock { self.session = session }
    }

    func cancel() {
        lock.withLock { session?.cancelExport() }
    }
}

enum ExportService {
    static func export(project: EditorProject, to outputURL: URL) async throws {
        let snapshot = try await ExportSourceSnapshot.create(project: project)
        defer { snapshot.discard() }

        // Everything, including the captions and the text: this is the one that
        // has to look like the finished video, because it is.
        let built = try await CompositionBuilder.build(project: snapshot.project, for: .export)
        let cancellation = ExportSessionCancellation()

        let expectedDuration = CMTimeGetSeconds(try await built.asset.load(.duration))
        let durationTolerance = max(
            0.25,
            (built.videoComposition?.frameDuration.seconds ?? 1.0 / 30.0) * 2
        )

        try await StagedFileDelivery.deliver(
            to: outputURL,
            produce: { stagedURL in
                try await withTaskCancellationHandler {
                    if let videoComposition = built.videoComposition,
                       videoComposition.customVideoCompositorClass != nil,
                       let animationTool = videoComposition.animationTool {
                        try await exportInTwoPasses(
                            built: built,
                            animationTool: animationTool,
                            to: stagedURL,
                            cancellation: cancellation
                        )
                    } else {
                        try await export(
                            asset: built.asset,
                            videoComposition: built.videoComposition,
                            audioMix: built.audioMix,
                            to: stagedURL,
                            cancellation: cancellation
                        )
                    }
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

    /// AVFoundation accepts a custom video compositor and a Core Animation
    /// tool on the same video composition, then silently omits the animation
    /// layers during export. Those layers are every caption, text card and
    /// still overlay. Render the custom composition first and burn the layer
    /// tree into that finished picture in a standard second pass.
    private static func exportInTwoPasses(
        built: BuiltComposition,
        animationTool: AVVideoCompositionCoreAnimationTool,
        to outputURL: URL,
        cancellation: ExportSessionCancellation
    ) async throws {
        let intermediateURL = FileManager.default.temporaryDirectory
            .appending(path: "yapper-composited-\(UUID().uuidString).mp4")
        defer { try? FileManager.default.removeItem(at: intermediateURL) }

        guard let firstPass = built.videoComposition else {
            throw NativeEditorError.exportFailed("The composed video pass was unavailable.")
        }
        firstPass.animationTool = nil
        try await export(
            asset: built.asset,
            videoComposition: firstPass,
            audioMix: built.audioMix,
            to: intermediateURL,
            cancellation: cancellation
        )

        let intermediate = AVURLAsset(url: intermediateURL)
        let duration = try await intermediate.load(.duration)
        let sourceVideo = try await intermediate.loadTracks(withMediaType: .video)
        guard let sourceVideo = sourceVideo.first else {
            throw NativeEditorError.exportFailed("The composed video pass contained no video.")
        }

        let composition = AVMutableComposition()
        guard let videoTrack = composition.addMutableTrack(
            withMediaType: .video,
            preferredTrackID: kCMPersistentTrackID_Invalid
        ) else {
            throw NativeEditorError.cannotCreateTrack("caption burn-in video")
        }
        let range = CMTimeRange(start: .zero, duration: duration)
        try videoTrack.insertTimeRange(range, of: sourceVideo, at: .zero)

        if let sourceAudio = try await intermediate.loadTracks(withMediaType: .audio).first,
           let audioTrack = composition.addMutableTrack(
               withMediaType: .audio,
               preferredTrackID: kCMPersistentTrackID_Invalid
           ) {
            try audioTrack.insertTimeRange(range, of: sourceAudio, at: .zero)
        }

        let secondPass = AVMutableVideoComposition()
        secondPass.renderSize = built.renderSize
        secondPass.frameDuration = firstPass.frameDuration
        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = range
        instruction.layerInstructions = [
            AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack),
        ]
        secondPass.instructions = [instruction]
        secondPass.animationTool = animationTool

        try await export(
            asset: composition,
            videoComposition: secondPass,
            audioMix: nil,
            to: outputURL,
            cancellation: cancellation
        )
    }

    private static func export(
        asset: AVAsset,
        videoComposition: AVVideoComposition?,
        audioMix: AVAudioMix?,
        to outputURL: URL,
        cancellation: ExportSessionCancellation
    ) async throws {
        try Task.checkCancellation()
        guard let session = AVAssetExportSession(
            asset: asset,
            presetName: AVAssetExportPresetHighestQuality
        ) else {
            throw NativeEditorError.exportFailed("AVAssetExportSession was unavailable.")
        }
        session.videoComposition = videoComposition
        session.audioMix = audioMix
        session.shouldOptimizeForNetworkUse = true
        cancellation.use(session)
        try await session.export(to: outputURL, as: .mp4)
    }
}
