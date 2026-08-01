@preconcurrency import AVFoundation
import AppKit
import CoreGraphics
import Foundation
import QuartzCore

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
        applyImageOverlays(
            project.overlays ?? [],
            project: project,
            renderSize: renderSize,
            duration: cursor.seconds,
            to: videoComposition
        )

        return BuiltComposition(
            asset: composition,
            videoComposition: videoComposition,
            renderSize: renderSize
        )
    }

    private static func applyImageOverlays(
        _ overlays: [ProjectOverlay],
        project: EditorProject,
        renderSize: CGSize,
        duration: Double,
        to videoComposition: AVMutableVideoComposition
    ) {
        let imageOverlays = overlays.compactMap { overlay -> (ProjectOverlay, ProjectMedia, CGImage)? in
            guard
                let media = project.media.first(where: { $0.id == overlay.mediaID }),
                media.isImage,
                let image = NSImage(contentsOf: media.url),
                let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
            else { return nil }
            return (overlay, media, cgImage)
        }
        guard !imageOverlays.isEmpty, duration > 0 else { return }

        let videoLayer = CALayer()
        videoLayer.frame = CGRect(origin: .zero, size: renderSize)
        let parentLayer = CALayer()
        parentLayer.frame = videoLayer.frame
        parentLayer.addSublayer(videoLayer)

        for (overlay, media, image) in imageOverlays {
            let layer = CALayer()
            layer.contents = image
            layer.contentsGravity = .resizeAspect
            layer.masksToBounds = true
            layer.cornerRadius = min(renderSize.width, renderSize.height) * 0.018
            layer.shadowColor = NSColor.black.cgColor
            layer.shadowOpacity = 0.28
            layer.shadowRadius = 12
            layer.shadowOffset = CGSize(width: 0, height: -4)

            let box = CGRect(
                x: renderSize.width * overlay.x,
                y: renderSize.height * (1 - overlay.y - overlay.height),
                width: renderSize.width * overlay.width,
                height: renderSize.height * overlay.height
            )
            let mediaAspect = CGFloat(media.width) / CGFloat(max(1, media.height))
            let boxAspect = box.width / max(1, box.height)
            if mediaAspect > boxAspect {
                let height = box.width / mediaAspect
                layer.frame = CGRect(x: box.minX, y: box.midY - height / 2, width: box.width, height: height)
            } else {
                let width = box.height * mediaAspect
                layer.frame = CGRect(x: box.midX - width / 2, y: box.minY, width: width, height: box.height)
            }

            layer.opacity = 0
            let animation = CAKeyframeAnimation(keyPath: "opacity")
            let start = max(0, min(1, overlay.timelineStart / duration))
            let end = max(start, min(1, (overlay.timelineStart + overlay.duration) / duration))
            let epsilon = min(0.0001, max(0.000001, 1 / max(1, duration * 60)))
            animation.values = [0, 0, 1, 1, 0]
            animation.keyTimes = [0, NSNumber(value: max(0, start - epsilon)), NSNumber(value: start), NSNumber(value: end), 1]
            animation.duration = duration
            animation.beginTime = AVCoreAnimationBeginTimeAtZero
            animation.isRemovedOnCompletion = false
            animation.fillMode = .both
            layer.add(animation, forKey: "timelineVisibility")
            parentLayer.addSublayer(layer)
        }

        videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
            postProcessingAsVideoLayer: videoLayer,
            in: parentLayer
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
