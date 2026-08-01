@preconcurrency import AVFoundation
import CoreGraphics
import Foundation

struct BuiltComposition: @unchecked Sendable {
    let asset: AVMutableComposition
    let videoComposition: AVMutableVideoComposition?
    let renderSize: CGSize

    @MainActor var playerItem: AVPlayerItem {
        let item = AVPlayerItem(asset: asset)
        item.videoComposition = videoComposition
        item.audioTimePitchAlgorithm = .spectral
        item.preferredForwardBufferDuration = 0
        return item
    }
}

private struct LoadedSource {
    // AVAssetTrack does not retain all of the source asset's loading state.
    // Keep the asset alive for the entire composition build.
    let asset: AVURLAsset
    let video: AVAssetTrack
    let audio: AVAssetTrack?
    let videoSize: CGSize
    let videoTransform: CGAffineTransform
    let audioTimeRange: CMTimeRange?
}

enum CompositionBuilder {
    static let timeScale: CMTimeScale = 600

    static func build(project: EditorProject) async throws -> BuiltComposition {
        guard !project.clips.isEmpty else { throw NativeEditorError.emptyTimeline }

        let composition = AVMutableComposition()
        guard let compositionVideo = composition.addMutableTrack(
            withMediaType: .video,
            preferredTrackID: kCMPersistentTrackID_Invalid
        ) else {
            throw NativeEditorError.cannotCreateTrack("video")
        }
        let compositionAudio = composition.addMutableTrack(
            withMediaType: .audio,
            preferredTrackID: kCMPersistentTrackID_Invalid
        )

        let firstMedia = try media(for: project.clips[0], in: project)
        let renderSize = evenSize(width: firstMedia.width, height: firstMedia.height)
        var cursor = CMTime.zero
        var instructions: [AVMutableVideoCompositionInstruction] = []
        var maximumFrameRate: Float = 30
        var sourceCache: [UUID: LoadedSource] = [:]

        for clip in project.clips {
            let media = try media(for: clip, in: project)
            let source: LoadedSource
            if let cached = sourceCache[media.id] {
                source = cached
            } else {
                let asset = AVURLAsset(url: media.url)
                let videoTracks = try await asset.loadTracks(withMediaType: .video)
                guard let sourceVideo = videoTracks.first else {
                    throw NativeEditorError.noVideoTrack(media.name)
                }
                let audio = try await asset.loadTracks(withMediaType: .audio).first
                let loaded = LoadedSource(
                    asset: asset,
                    video: sourceVideo,
                    audio: audio,
                    videoSize: try await sourceVideo.load(.naturalSize),
                    videoTransform: try await sourceVideo.load(.preferredTransform),
                    audioTimeRange: try await audio?.load(.timeRange)
                )
                let frameRate = try await sourceVideo.load(.nominalFrameRate)
                if frameRate.isFinite, frameRate > 0 {
                    maximumFrameRate = max(maximumFrameRate, min(120, frameRate))
                }
                sourceCache[media.id] = loaded
                source = loaded
            }
            let sourceRange = CMTimeRange(
                start: CMTime(seconds: clip.sourceStart, preferredTimescale: timeScale),
                duration: CMTime(seconds: clip.duration, preferredTimescale: timeScale)
            )
            try compositionVideo.insertTimeRange(sourceRange, of: source.video, at: cursor)

            let segmentRange = CMTimeRange(start: cursor, duration: sourceRange.duration)
            let instruction = AVMutableVideoCompositionInstruction()
            instruction.timeRange = segmentRange
            let layerInstruction = AVMutableVideoCompositionLayerInstruction(
                assetTrack: compositionVideo
            )
            layerInstruction.setTransform(
                fittedTransform(
                    naturalSize: source.videoSize,
                    preferredTransform: source.videoTransform,
                    renderSize: renderSize
                ),
                at: cursor
            )
            instruction.layerInstructions = [layerInstruction]
            instructions.append(instruction)

            if let compositionAudio {
                if
                    let sourceAudio = source.audio,
                    let availableRange = source.audioTimeRange
                {
                    let intersection = CMTimeRangeGetIntersection(
                        sourceRange,
                        otherRange: availableRange
                    )
                    if intersection.duration > .zero {
                        let offset = intersection.start - sourceRange.start
                        try compositionAudio.insertTimeRange(
                            intersection,
                            of: sourceAudio,
                            at: cursor + offset
                        )
                    }
                } else {
                    compositionAudio.insertEmptyTimeRange(segmentRange)
                }
            }
            cursor = cursor + sourceRange.duration
        }

        let videoComposition = AVMutableVideoComposition()
        videoComposition.renderSize = renderSize
        videoComposition.frameDuration = CMTime(
            value: 1,
            timescale: CMTimeScale(maximumFrameRate.rounded())
        )
        videoComposition.instructions = instructions

        return BuiltComposition(
            asset: composition,
            videoComposition: videoComposition,
            renderSize: renderSize
        )
    }

    private static func media(
        for clip: TimelineClip,
        in project: EditorProject
    ) throws -> ProjectMedia {
        guard let media = project.media(for: clip) else {
            throw NativeEditorError.missingMedia(clip.mediaID)
        }
        return media
    }

    private static func evenSize(width: Int, height: Int) -> CGSize {
        CGSize(
            width: max(2, width - width % 2),
            height: max(2, height - height % 2)
        )
    }

    private static func fittedTransform(
        naturalSize: CGSize,
        preferredTransform: CGAffineTransform,
        renderSize: CGSize
    ) -> CGAffineTransform {
        let orientedRect = CGRect(origin: .zero, size: naturalSize)
            .applying(preferredTransform)
        let orientedSize = CGSize(
            width: abs(orientedRect.width),
            height: abs(orientedRect.height)
        )
        guard orientedSize.width > 0, orientedSize.height > 0 else {
            return preferredTransform
        }

        let scale = min(
            renderSize.width / orientedSize.width,
            renderSize.height / orientedSize.height
        )
        var transform = preferredTransform
        transform = transform.concatenating(
            CGAffineTransform(
                translationX: -orientedRect.minX,
                y: -orientedRect.minY
            )
        )
        transform = transform.concatenating(
            CGAffineTransform(scaleX: scale, y: scale)
        )
        let outputSize = CGSize(
            width: orientedSize.width * scale,
            height: orientedSize.height * scale
        )
        transform = transform.concatenating(
            CGAffineTransform(
                translationX: (renderSize.width - outputSize.width) / 2,
                y: (renderSize.height - outputSize.height) / 2
            )
        )
        return transform
    }
}
