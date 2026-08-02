@preconcurrency import AVFoundation
import AppKit
import CoreGraphics
import Foundation
import QuartzCore

struct BuiltComposition: @unchecked Sendable {
    let asset: AVMutableComposition
    let videoComposition: AVMutableVideoComposition?
    let playbackVideoComposition: AVMutableVideoComposition?
    let audioMix: AVAudioMix?
    let renderSize: CGSize

    @MainActor var playerItem: AVPlayerItem {
        let item = AVPlayerItem(asset: asset)
        // Core Animation tools are valid for export, but AVPlayerItem rejects
        // them with an Objective-C exception. The SwiftUI canvas renders text
        // and overlays live, while this clean composition handles crop/rotation.
        item.videoComposition = playbackVideoComposition
        item.audioMix = audioMix
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
        let renderSize = renderSize(
            sourceWidth: firstMedia.width,
            sourceHeight: firstMedia.height,
            aspectRatio: project.selectedAspectRatio
        )
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

        let playbackVideoComposition = AVMutableVideoComposition()
        playbackVideoComposition.renderSize = videoComposition.renderSize
        playbackVideoComposition.frameDuration = videoComposition.frameDuration
        playbackVideoComposition.instructions = instructions
        applyVisualLayers(
            project.overlays ?? [],
            textLayers: project.textLayers ?? [],
            project: project,
            renderSize: renderSize,
            duration: cursor.seconds,
            to: videoComposition
        )

        let audioMix = try await addAudioLayers(
            project.audioLayers ?? [],
            to: composition,
            compositionDuration: cursor
        )

        return BuiltComposition(
            asset: composition,
            videoComposition: videoComposition,
            playbackVideoComposition: playbackVideoComposition,
            audioMix: audioMix,
            renderSize: renderSize
        )
    }

    private static func addAudioLayers(
        _ layers: [ProjectAudioLayer],
        to composition: AVMutableComposition,
        compositionDuration: CMTime
    ) async throws -> AVAudioMix? {
        guard !layers.isEmpty, compositionDuration > .zero else { return nil }
        var parameters: [AVMutableAudioMixInputParameters] = []

        for layer in layers {
            let destinationStart = CMTime(
                seconds: max(0, layer.timelineStart),
                preferredTimescale: timeScale
            )
            guard destinationStart < compositionDuration else { continue }

            let asset = AVURLAsset(url: layer.url)
            guard let sourceTrack = try await asset.loadTracks(withMediaType: .audio).first else {
                throw NativeEditorError.noAudioTrack(layer.name)
            }
            let available = try await sourceTrack.load(.timeRange)
            let requestedStart = CMTime(
                seconds: max(0, layer.sourceStart),
                preferredTimescale: timeScale
            )
            let sourceStart = max(available.start, requestedStart)
            let remainingSource = max(.zero, available.end - sourceStart)
            let remainingTimeline = max(.zero, compositionDuration - destinationStart)
            let requestedDuration = CMTime(
                seconds: max(0, layer.duration),
                preferredTimescale: timeScale
            )
            let duration = min(requestedDuration, min(remainingSource, remainingTimeline))
            guard duration > .zero else { continue }
            guard let track = composition.addMutableTrack(
                withMediaType: .audio,
                preferredTrackID: kCMPersistentTrackID_Invalid
            ) else {
                throw NativeEditorError.cannotCreateTrack("sound effect")
            }
            try track.insertTimeRange(
                CMTimeRange(start: sourceStart, duration: duration),
                of: sourceTrack,
                at: destinationStart
            )
            let input = AVMutableAudioMixInputParameters(track: track)
            input.setVolume(Float(min(2, max(0, layer.volume))), at: destinationStart)
            parameters.append(input)
        }

        guard !parameters.isEmpty else { return nil }
        let mix = AVMutableAudioMix()
        mix.inputParameters = parameters
        return mix
    }

    private static func applyVisualLayers(
        _ overlays: [ProjectOverlay],
        textLayers: [ProjectTextLayer],
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
        guard (!imageOverlays.isEmpty || !textLayers.isEmpty), duration > 0 else { return }

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

            applyVisibility(
                to: layer,
                start: overlay.timelineStart,
                layerDuration: overlay.duration,
                compositionDuration: duration
            )
            parentLayer.addSublayer(layer)
        }

        for text in textLayers where !text.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let fontSize = max(18, renderSize.height * text.fontScale)
            let font = textFont(for: text.font, size: fontSize)
            let paragraph = NSMutableParagraphStyle()
            paragraph.alignment = .center
            paragraph.lineBreakMode = .byWordWrapping
            let foreground: NSColor = text.style == .whiteCard ? .black : .white
            let attributed = NSAttributedString(
                string: text.text,
                attributes: [
                    .font: font,
                    .foregroundColor: foreground,
                    .paragraphStyle: paragraph,
                ]
            )
            let maximumTextWidth = max(fontSize * 3, renderSize.width * text.width)
            let measured = attributed.boundingRect(
                with: CGSize(width: maximumTextWidth, height: renderSize.height * 0.5),
                options: [.usesLineFragmentOrigin, .usesFontLeading]
            )
            let horizontalPadding = text.style == .plain ? fontSize * 0.08 : fontSize * 0.48
            let verticalPadding = text.style == .plain ? fontSize * 0.08 : fontSize * 0.32
            let boxSize = CGSize(
                width: min(renderSize.width * 0.94, max(fontSize * 2, ceil(measured.width) + horizontalPadding * 2)),
                height: min(renderSize.height * 0.46, max(fontSize * 1.2, ceil(measured.height) + verticalPadding * 2))
            )

            let container = CALayer()
            container.frame = CGRect(
                x: renderSize.width * text.x - boxSize.width / 2,
                y: renderSize.height * (1 - text.y) - boxSize.height / 2,
                width: boxSize.width,
                height: boxSize.height
            )
            container.cornerRadius = fontSize * 0.32
            switch text.style {
            case .plain:
                container.backgroundColor = NSColor.clear.cgColor
            case .whiteCard:
                container.backgroundColor = NSColor.white.withAlphaComponent(0.96).cgColor
            case .blackCard:
                container.backgroundColor = NSColor.black.withAlphaComponent(0.88).cgColor
            }

            let textLayer = CATextLayer()
            textLayer.contentsScale = 2
            textLayer.isWrapped = true
            textLayer.alignmentMode = .center
            textLayer.string = attributed
            textLayer.frame = CGRect(
                x: horizontalPadding,
                y: verticalPadding,
                width: boxSize.width - horizontalPadding * 2,
                height: boxSize.height - verticalPadding * 2
            )
            if text.style == .plain {
                textLayer.shadowColor = NSColor.black.cgColor
                textLayer.shadowOpacity = 0.82
                textLayer.shadowRadius = max(3, fontSize * 0.08)
                textLayer.shadowOffset = CGSize(width: 0, height: -2)
            }
            container.addSublayer(textLayer)
            applyVisibility(
                to: container,
                start: text.timelineStart,
                layerDuration: text.duration,
                compositionDuration: duration
            )
            parentLayer.addSublayer(container)
        }

        videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
            postProcessingAsVideoLayer: videoLayer,
            in: parentLayer
        )
    }

    private static func applyVisibility(
        to layer: CALayer,
        start: Double,
        layerDuration: Double,
        compositionDuration: Double
    ) {
        layer.opacity = 0
        let animation = CAKeyframeAnimation(keyPath: "opacity")
        let normalizedStart = max(0, min(1, start / compositionDuration))
        let normalizedEnd = max(
            normalizedStart,
            min(1, (start + layerDuration) / compositionDuration)
        )
        let epsilon = min(0.0001, max(0.000001, 1 / max(1, compositionDuration * 60)))
        animation.values = [0, 0, 1, 1, 0]
        animation.keyTimes = [
            0,
            NSNumber(value: max(0, normalizedStart - epsilon)),
            NSNumber(value: normalizedStart),
            NSNumber(value: normalizedEnd),
            1,
        ]
        animation.duration = compositionDuration
        animation.beginTime = AVCoreAnimationBeginTimeAtZero
        animation.isRemovedOnCompletion = false
        animation.fillMode = .both
        layer.add(animation, forKey: "timelineVisibility")
    }

    private static func textFont(for family: TextLayerFont, size: CGFloat) -> NSFont {
        switch family {
        case .modern:
            return NSFont.systemFont(ofSize: size, weight: .bold)
        case .rounded:
            let base = NSFont.systemFont(ofSize: size, weight: .heavy)
            if let descriptor = base.fontDescriptor.withDesign(.rounded),
               let rounded = NSFont(descriptor: descriptor, size: size)
            {
                return rounded
            }
            return base
        case .editorial:
            return NSFont(name: "New York", size: size)
                ?? NSFont.systemFont(ofSize: size, weight: .semibold)
        }
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

    static func renderSize(
        sourceWidth: Int,
        sourceHeight: Int,
        aspectRatio: ProjectAspectRatio
    ) -> CGSize {
        guard let ratio = aspectRatio.ratio else {
            return evenSize(width: sourceWidth, height: sourceHeight)
        }
        let longEdge = max(2, max(sourceWidth, sourceHeight))
        if ratio <= 1 {
            return evenSize(
                width: Int((Double(longEdge) * ratio).rounded()),
                height: longEdge
            )
        }
        return evenSize(
            width: longEdge,
            height: Int((Double(longEdge) / ratio).rounded())
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
