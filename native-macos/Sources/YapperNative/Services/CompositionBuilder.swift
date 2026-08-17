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
    let hasRenderedAudio: Bool

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

/// One clip of the main track, and where it sits in the finished frame.
///
/// Carries what it takes to work the transform out again at any moment rather
/// than only the one it starts at, because a keyed clip is a different picture
/// every frame: see `FramingKey`.
private struct MainSegment {
    let range: CMTimeRange
    /// The whole clip, for its keys and where it starts in its own media.
    let clip: TimelineClip
    let naturalSize: CGSize
    let preferredTransform: CGAffineTransform
    let renderSize: CGSize

    var isKeyed: Bool { VideoFramingTrack.isKeyed(clip) }

    /// Where the picture sits at one moment of the finished video.
    func transform(atTimeline time: Double) -> CGAffineTransform {
        let intoClip = max(0, time - range.start.seconds)
        let framing = VideoFramingTrack.framing(
            of: clip,
            atSource: clip.sourceStart + intoClip
        )
        return CompositionBuilder.fittedTransform(
            naturalSize: naturalSize,
            preferredTransform: preferredTransform,
            renderSize: renderSize,
            framing: framing
        )
    }

    /// What it is framed at throughout, for a clip that does not move.
    var transform: CGAffineTransform { transform(atTimeline: range.start.seconds) }

    /// The moments this clip's framing changes direction, in timeline seconds.
    var keyframeTimes: [Double] {
        VideoFramingTrack.keys(of: clip).map {
            range.start.seconds + ($0.at - clip.sourceStart)
        }
    }
}

/// A moving cutaway: everything needed to place it at any second of its life.
private struct OverlayMotion {
    let overlay: ProjectOverlay
    let naturalSize: CGSize
    let preferredTransform: CGAffineTransform
    let crop: OverlayCrop
    let renderSize: CGSize
    let mediaAspect: Double

    /// Where the card sits at one moment of the finished video.
    func transform(atTimeline time: Double) -> CGAffineTransform {
        let box = OverlayKeyTrack.box(of: overlay, atTimeline: time)
        let frame = OverlayFrame.fitted(
            CGRect(
                x: box.x * renderSize.width,
                y: box.y * renderSize.height,
                width: box.width * renderSize.width,
                height: box.height * renderSize.height
            ),
            mediaAspect: OverlayFrame.shownAspect(mediaAspect: mediaAspect, crop: crop)
        )
        return CompositionBuilder.overlayTransform(
            naturalSize: naturalSize,
            preferredTransform: preferredTransform,
            crop: crop,
            box: frame
        )
    }

    /// The moments this cutaway changes direction, in timeline seconds.
    var keyframeTimes: [Double] {
        OverlayKeyTrack.keys(of: overlay).map { overlay.timelineStart + $0.at }
    }
}

/// A track of video overlays and the transform each of them is drawn with.
/// Lanes are ordered back to front, so a later lane covers an earlier one.
private struct CutawayLane {
    let track: AVMutableCompositionTrack
    let overlays: [ProjectOverlay]
    let transforms: [UUID: CGAffineTransform]
    /// What it takes to work an overlay's transform out again at any moment,
    /// for the ones that move. Empty for a lane where nothing is keyed, which
    /// builds exactly the composition it always did.
    var motion: [UUID: OverlayMotion] = [:]
    /// The part of each cutaway's own picture that survives, in the source's
    /// pixels. AVFoundation applies this before the transform, so it is the
    /// crop expressed where the crop was drawn: on the media itself.
    let cropRects: [UUID: CGRect]
}

/// What a composition is being built for, which decides how much of it there is
/// to build.
///
/// The two differ by the Core Animation pass that draws the captions, the text
/// and the image overlays into the frame. An export needs it. The player cannot
/// use it at all: `AVPlayerItem` rejects an animation tool, which is why the
/// canvas draws those things itself, live, in SwiftUI.
///
/// So the preview was building a text layer per caption and throwing every one
/// of them away. On a real project that was 288 of them, and measured in the
/// running app it was over a second of the wait after every single edit.
enum CompositionPurpose {
    case preview
    case export

    var needsVisualLayers: Bool { self == .export }
}

enum CompositionBuilder {
    static let timeScale: CMTimeScale = 600

    static func build(
        project: EditorProject,
        for purpose: CompositionPurpose = .export
    ) async throws -> BuiltComposition {
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
        var segments: [MainSegment] = []
        var maximumFrameRate: Float = 30
        var sourceCache: [UUID: LoadedSource] = [:]

        for clip in project.clips {
            let media = try media(for: clip, in: project)
            let source: LoadedSource
            if let cached = sourceCache[media.id] {
                source = cached
            } else {
                let loaded = try await CompositionSourceCache.shared.source(for: media)
                if loaded.frameRate.isFinite, loaded.frameRate > 0 {
                    maximumFrameRate = max(maximumFrameRate, min(120, loaded.frameRate))
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
            segments.append(
                MainSegment(
                    range: segmentRange,
                    clip: clip,
                    naturalSize: source.videoSize,
                    preferredTransform: source.videoTransform,
                    renderSize: renderSize
                )
            )

            if let compositionAudio {
                if
                    !project.isVideoTrackMuted,
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

        let overlays = project.overlays ?? []
        let cutaways = try await addVideoOverlays(
            overlays,
            project: project,
            to: composition,
            renderSize: renderSize,
            compositionDuration: cursor.seconds,
            sourceCache: &sourceCache
        )
        let filter = project.resolvedVisualFilter
        let instructions = instructions(
            segments: segments,
            cutaways: cutaways,
            mainTrack: compositionVideo,
            isMainTrackHidden: project.isVideoTrackHidden,
            filter: filter,
            duration: cursor.seconds
        )

        // Stated, not inferred: see CompositionColorSpace. Taken from the take
        // the timeline opens on, so a cutaway joining the composition is
        // converted into that instead of moving it.
        let outputColor = await CompositionColorSpace.tags(
            of: sourceCache[project.clips[0].mediaID]?.video
        )

        let videoComposition = AVMutableVideoComposition()
        CompositionColorSpace.apply(outputColor, to: videoComposition)
        videoComposition.renderSize = renderSize
        videoComposition.frameDuration = CMTime(
            value: 1,
            timescale: CMTimeScale(maximumFrameRate.rounded())
        )
        // A graded project is composited by hand, because a colour pass is not
        // something layer instructions can express. An ungraded one stays on
        // AVFoundation's own compositor.
        if !filter.isNeutral {
            videoComposition.customVideoCompositorClass = StudioVideoCompositor.self
        }
        videoComposition.instructions = instructions

        // The preview renders at the export's size on purpose. Rendering it
        // smaller looks like an obvious saving and is not: the source decodes at
        // full size whichever frame it lands in, so a smaller frame only adds a
        // resample. Measured on 4K footage, pulling frames through a correctly
        // scaled 1080p preview ran at 130 fps against 185 fps at full size.
        let playbackVideoComposition = AVMutableVideoComposition()
        CompositionColorSpace.apply(outputColor, to: playbackVideoComposition)
        playbackVideoComposition.renderSize = videoComposition.renderSize
        playbackVideoComposition.frameDuration = videoComposition.frameDuration
        if !filter.isNeutral {
            playbackVideoComposition.customVideoCompositorClass = StudioVideoCompositor.self
        }
        playbackVideoComposition.instructions = instructions
        if purpose.needsVisualLayers {
            try applyVisualLayers(
                overlays,
                textLayers: project.textLayers ?? [],
                captions: project.captionCues,
                project: project,
                renderSize: renderSize,
                duration: cursor.seconds,
                to: videoComposition
            )
        }

        let mainTrackHasAudio = compositionAudio?.segments.contains { !$0.isEmpty } == true
        if let compositionAudio, !mainTrackHasAudio {
            composition.removeTrack(compositionAudio)
        }
        let audioMix = try await addAudioLayers(
            (project.audioLayers ?? []).filter { MediaAvailability.isRequired($0, in: project) },
            to: composition,
            compositionDuration: cursor,
            mainTrack: mainTrackHasAudio ? compositionAudio : nil,
            mainVolume: project.resolvedVideoTrackVolume
        )
        let hasRenderedAudio = composition.tracks(withMediaType: .audio).contains { track in
            track.segments.contains { !$0.isEmpty }
        }

        return BuiltComposition(
            asset: composition,
            videoComposition: videoComposition,
            playbackVideoComposition: playbackVideoComposition,
            audioMix: audioMix,
            renderSize: renderSize,
            hasRenderedAudio: hasRenderedAudio
        )
    }

    private static func track(
        _ trackID: CMPersistentTrackID,
        mainTrack: AVMutableCompositionTrack,
        cutaways: [CutawayLane]
    ) -> AVMutableCompositionTrack {
        cutaways.first { $0.track.trackID == trackID }?.track ?? mainTrack
    }

    /// Lays every video overlay onto its own track so it can play over the
    /// speaker. Images are not here: they are drawn by `applyVisualLayers`,
    /// which can round their corners and is not limited to four tracks.
    ///
    /// Overlay audio is deliberately left out. A cutaway is a picture over the
    /// speaker's own voice, and mixing a second dialogue track under it without
    /// being asked would be a surprise, not a feature.
    private static func addVideoOverlays(
        _ overlays: [ProjectOverlay],
        project: EditorProject,
        to composition: AVMutableComposition,
        renderSize: CGSize,
        compositionDuration: Double,
        sourceCache: inout [UUID: LoadedSource]
    ) async throws -> [CutawayLane] {
        let cutaways = overlays.filter { overlay in
            guard
                overlay.isVisible,
                let media = project.media.first(where: { $0.id == overlay.mediaID })
            else { return false }
            return !media.isImage
        }
        guard !cutaways.isEmpty, compositionDuration > 0 else { return [] }

        var lanes: [CutawayLane] = []
        for lane in OverlayCompositionPlan.lanes(for: cutaways) {
            guard let track = composition.addMutableTrack(
                withMediaType: .video,
                preferredTrackID: kCMPersistentTrackID_Invalid
            ) else {
                throw NativeEditorError.cannotCreateTrack("overlay video")
            }

            var placed: [ProjectOverlay] = []
            var transforms: [UUID: CGAffineTransform] = [:]
            var motion: [UUID: OverlayMotion] = [:]
            var cropRects: [UUID: CGRect] = [:]
            for overlay in lane {
                guard let media = project.media.first(where: { $0.id == overlay.mediaID }) else {
                    continue
                }
                let source: LoadedSource
                if let cached = sourceCache[media.id] {
                    source = cached
                } else {
                    source = try await CompositionSourceCache.shared.source(for: media)
                    sourceCache[media.id] = source
                }

                let start = max(0, overlay.timelineStart)
                let available = min(
                    max(0, source.duration - max(0, overlay.sourceStart)),
                    max(0, compositionDuration - start)
                )
                let duration = min(overlay.duration, available)
                guard duration > OverlayCompositionPlan.epsilon else { continue }

                try track.insertTimeRange(
                    CMTimeRange(
                        start: CMTime(seconds: max(0, overlay.sourceStart), preferredTimescale: timeScale),
                        duration: CMTime(seconds: duration, preferredTimescale: timeScale)
                    ),
                    of: source.video,
                    at: CMTime(seconds: start, preferredTimescale: timeScale)
                )

                var clamped = overlay
                clamped.timelineStart = start
                clamped.duration = duration
                placed.append(clamped)
                let box = OverlayFrame.fitted(
                    OverlayFrame.box(overlay, in: renderSize),
                    mediaAspect: OverlayFrame.shownAspect(
                        mediaAspect: aspect(of: media),
                        crop: overlay.resolvedCrop
                    )
                )
                let crop = overlay.resolvedCrop
                if !crop.isFull {
                    let oriented = CGRect(origin: .zero, size: source.videoSize)
                        .applying(source.videoTransform)
                    let orientedSize = CGSize(
                        width: abs(oriented.width),
                        height: abs(oriented.height)
                    )
                    cropRects[overlay.id] = CGRect(
                        x: crop.x * orientedSize.width,
                        y: crop.y * orientedSize.height,
                        width: crop.width * orientedSize.width,
                        height: crop.height * orientedSize.height
                    )
                }
                transforms[overlay.id] = overlayTransform(
                    naturalSize: source.videoSize,
                    preferredTransform: source.videoTransform,
                    crop: overlay.resolvedCrop,
                    box: box
                )
                if OverlayKeyTrack.isKeyed(overlay) {
                    motion[overlay.id] = OverlayMotion(
                        overlay: overlay,
                        naturalSize: source.videoSize,
                        preferredTransform: source.videoTransform,
                        crop: overlay.resolvedCrop,
                        renderSize: renderSize,
                        mediaAspect: aspect(of: media)
                    )
                }
            }
            if !placed.isEmpty {
                lanes.append(
                    CutawayLane(
                        track: track,
                        overlays: placed,
                        transforms: transforms,
                        motion: motion,
                        cropRects: cropRects
                    )
                )
            }
        }
        return lanes
    }

    /// One instruction per stretch of time where the picture is unchanged: a
    /// cut on the main track, or a cutaway arriving or leaving, starts a new
    /// one. Within an instruction the front-most layer comes first, so the
    /// cutaway lanes are listed before the speaker.
    private static func instructions(
        segments: [MainSegment],
        cutaways: [CutawayLane],
        mainTrack: AVMutableCompositionTrack,
        isMainTrackHidden: Bool,
        filter: VisualFilter,
        duration: Double
    ) -> [any AVVideoCompositionInstructionProtocol] {
        let boundaries = OverlayCompositionPlan.boundaries(
            clipEnds: segments.map(\.range.end.seconds),
            overlays: cutaways.flatMap(\.overlays),
            duration: duration,
            keyframes: segments.flatMap(\.keyframeTimes)
                + cutaways.flatMap { $0.motion.values.flatMap(\.keyframeTimes) }
        )
        guard boundaries.count > 1 else { return [] }

        let matrix = filter.colorMatrix
        var instructions: [any AVVideoCompositionInstructionProtocol] = []
        for (index, start) in boundaries.dropLast().enumerated() {
            let end = boundaries[index + 1]
            let midpoint = (start + end) / 2
            guard let segment = segments.first(where: {
                midpoint >= $0.range.start.seconds && midpoint <= $0.range.end.seconds
            }) ?? segments.last else { continue }

            let timeRange = CMTimeRange(
                start: CMTime(seconds: start, preferredTimescale: timeScale),
                end: CMTime(seconds: end, preferredTimescale: timeScale)
            )

            // Front to back: the cutaways on top of the speaker.
            var placements: [StudioCompositionInstruction.Layer] = []
            for lane in cutaways.reversed() {
                guard
                    let overlay = OverlayCompositionPlan.overlay(in: lane.overlays, from: start, to: end),
                    let transform = lane.transforms[overlay.id]
                else { continue }
                // A keyed cutaway is given both ends of this stretch, exactly
                // as the main track is, so a card that slides in or grows is
                // the same mechanism as a punch-in rather than a second one.
                let motion = lane.motion[overlay.id]
                let from = motion?.transform(atTimeline: start) ?? transform
                let to = motion?.transform(atTimeline: end)
                placements.append(
                    .init(
                        trackID: lane.track.trackID,
                        transform: from,
                        endTransform: to == from ? nil : to,
                        cropRect: lane.cropRects[overlay.id],
                        opacity: 1
                    )
                )
            }
            // A keyed clip moves across this instruction, so it is given both
            // ends and whichever compositor is running interpolates between
            // them. Every key is a boundary, so the move inside one instruction
            // is always a straight line.
            let mainStart = segment.isKeyed ? segment.transform(atTimeline: start) : segment.transform
            let mainEnd = segment.isKeyed ? segment.transform(atTimeline: end) : nil
            placements.append(
                .init(
                    trackID: mainTrack.trackID,
                    transform: mainStart,
                    endTransform: mainEnd == mainStart ? nil : mainEnd,
                    cropRect: nil,
                    opacity: isMainTrackHidden ? 0 : 1
                )
            )

            if filter.isNeutral {
                let instruction = AVMutableVideoCompositionInstruction()
                instruction.timeRange = timeRange
                instruction.layerInstructions = placements.map { placement in
                    let layer = AVMutableVideoCompositionLayerInstruction(
                        assetTrack: track(placement.trackID, mainTrack: mainTrack, cutaways: cutaways)
                    )
                    if let endTransform = placement.endTransform {
                        layer.setTransformRamp(
                            fromStart: placement.transform,
                            toEnd: endTransform,
                            timeRange: timeRange
                        )
                    } else {
                        layer.setTransform(placement.transform, at: timeRange.start)
                    }
                    if let cropRect = placement.cropRect {
                        layer.setCropRectangle(cropRect, at: timeRange.start)
                    }
                    if placement.opacity < 1 {
                        layer.setOpacity(placement.opacity, at: timeRange.start)
                    }
                    return layer
                }
                instructions.append(instruction)
            } else {
                instructions.append(
                    StudioCompositionInstruction(
                        timeRange: timeRange,
                        layers: placements,
                        colorMatrix: matrix
                    )
                )
            }
        }
        return instructions
    }

    /// - Parameters:
    ///   - mainTrack: the speaker's own audio, which has a fader of its own.
    ///   - mainVolume: what that fader is set to. Only given input parameters
    ///     when it is set to something, so a project nobody has touched builds
    ///     exactly the composition it always did.
    private static func addAudioLayers(
        _ layers: [ProjectAudioLayer],
        to composition: AVMutableComposition,
        compositionDuration: CMTime,
        mainTrack: AVMutableCompositionTrack? = nil,
        mainVolume: Double = 1
    ) async throws -> AVAudioMix? {
        guard compositionDuration > .zero else { return nil }
        var parameters: [AVMutableAudioMixInputParameters] = []

        if let mainTrack, abs(mainVolume - 1) > 0.001 {
            let input = AVMutableAudioMixInputParameters(track: mainTrack)
            input.setVolume(Float(AudioLevel.clamped(mainVolume)), at: .zero)
            parameters.append(input)
        }
        guard !layers.isEmpty || !parameters.isEmpty else { return nil }

        for layer in layers {
            let sourceURL: URL
            if let id = layer.builtInID {
                guard let effect = SoundEffectDescriptor.library.first(where: { $0.id == id }),
                      let bundled = SoundEffectService.shared.bundledURL(for: effect)
                else { throw NativeEditorError.missingSoundEffect(layer.name) }
                sourceURL = bundled
            } else {
                sourceURL = layer.url
            }
            let destinationStart = CMTime(
                seconds: max(0, layer.timelineStart),
                preferredTimescale: timeScale
            )
            guard destinationStart < compositionDuration else { continue }

            let loaded = try await CompositionSourceCache.shared.audioSource(
                for: sourceURL,
                name: layer.name
            )
            let sourceTrack = loaded.track
            let available = loaded.timeRange
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
            input.setVolume(Float(AudioLevel.clamped(layer.volume)), at: destinationStart)
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
        captions: [ProjectCaptionCue],
        project: EditorProject,
        renderSize: CGSize,
        duration: Double,
        to videoComposition: AVMutableVideoComposition
    ) throws {
        var imageOverlays: [(ProjectOverlay, ProjectMedia, CGImage)] = []
        for overlay in OverlayTracks.backToFront(overlays) where
            overlay.isVisible && overlay.duration > 0 && overlay.timelineStart < duration &&
                overlay.timelineStart + overlay.duration > 0
        {
            guard let media = project.media.first(where: { $0.id == overlay.mediaID }) else {
                throw NativeEditorError.missingMedia(overlay.mediaID)
            }
            guard media.isImage else { continue }
            guard MediaAvailability.isRegularReadableFile(media.url),
                  let image = NSImage(contentsOf: media.url),
                  let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
            else { throw NativeEditorError.incompatibleMedia(media.name) }
            imageOverlays.append((overlay, media, cgImage))
        }
        guard (!imageOverlays.isEmpty || !textLayers.isEmpty || !captions.isEmpty), duration > 0 else { return }

        let videoLayer = CALayer()
        videoLayer.frame = CGRect(origin: .zero, size: renderSize)
        let parentLayer = CALayer()
        parentLayer.frame = videoLayer.frame
        parentLayer.addSublayer(videoLayer)

        // The grade covers the footage and the overlays laid over it, exactly
        // as it does in the browser. Captions and text stay ungraded: they are
        // the editor's own marks on the picture, not part of it.
        let grade = project.resolvedVisualFilter.colorMatrix
        for (overlay, media, image) in imageOverlays {
            let layer = CALayer()
            layer.contents = grade.graded(image) ?? image
            let crop = overlay.resolvedCrop
            if !crop.isFull {
                // Core Animation measures its contents from the bottom left.
                layer.contentsRect = CGRect(
                    x: crop.x,
                    y: 1 - crop.y - crop.height,
                    width: crop.width,
                    height: crop.height
                )
                layer.contentsGravity = .resizeAspectFill
            } else {
                layer.contentsGravity = .resizeAspect
            }
            layer.masksToBounds = true
            // A card on top of the picture is rounded and casts a shadow. A
            // graphic cut to the whole frame is part of the picture, so it gets
            // neither.
            if !OverlayFrame.isFullFrame(overlay) {
                layer.cornerRadius = OverlayFrame.cornerRadius(in: renderSize)
                layer.shadowColor = NSColor.black.cgColor
                layer.shadowOpacity = 0.28
                layer.shadowRadius = 12
                layer.shadowOffset = CGSize(width: 0, height: -4)
            }

            // The canvas measures from the top of the frame and Core Animation
            // from the bottom, so the fitted box is flipped on its way in.
            let box = OverlayFrame.fitted(
                OverlayFrame.box(overlay, in: renderSize),
                mediaAspect: OverlayFrame.shownAspect(
                    mediaAspect: aspect(of: media),
                    crop: overlay.resolvedCrop
                )
            )
            layer.frame = CGRect(
                x: box.minX,
                y: renderSize.height - box.maxY,
                width: box.width,
                height: box.height
            )

            applyVisibility(
                to: layer,
                start: overlay.timelineStart,
                layerDuration: overlay.duration,
                compositionDuration: duration
            )
            // A keyed still moves by Core Animation rather than by a transform
            // ramp: it is drawn into the frame by the animation tool, not by a
            // composition track, so it has no layer instruction to ramp. Both
            // roads have to lead to the same picture, or keyframing a
            // screenshot would work in the preview and export as a still.
            applyMotion(
                to: layer,
                overlay: overlay,
                mediaAspect: aspect(of: media),
                renderSize: renderSize,
                compositionDuration: duration
            )
            parentLayer.addSublayer(layer)
        }

        for text in textLayers where !text.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let container = TextAppearanceLayer.make(
                text: text.text,
                appearance: text.appearance,
                renderSize: renderSize,
                centerX: text.x,
                centerY: text.y,
                maximumWidth: min(0.94, text.width),
                maximumHeight: 0.46
            )
            applyVisibility(
                to: container,
                start: text.timelineStart,
                layerDuration: text.duration,
                compositionDuration: duration
            )
            parentLayer.addSublayer(container)
        }

        for caption in captions where !caption.text.isEmpty && caption.duration > 0 {
            let container = TextAppearanceLayer.make(
                text: caption.text,
                appearance: caption.style.appearance,
                renderSize: renderSize,
                centerX: caption.style.x,
                centerY: caption.style.y,
                maximumWidth: caption.style.width,
                maximumHeight: 0.4
            )
            applyVisibility(
                to: container,
                start: caption.timelineStart,
                layerDuration: caption.duration,
                compositionDuration: duration
            )
            parentLayer.addSublayer(container)
        }

        videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
            postProcessingAsVideoLayer: videoLayer,
            in: parentLayer
        )
    }

    /// Animates a keyed still along the boxes it was given.
    ///
    /// Core Animation measures from the bottom left, so every box is flipped on
    /// the way in, exactly as the static frame above it is.
    private static func applyMotion(
        to layer: CALayer,
        overlay: ProjectOverlay,
        mediaAspect: Double,
        renderSize: CGSize,
        compositionDuration: Double
    ) {
        let keys = OverlayKeyTrack.keys(of: overlay)
        guard keys.count > 1, compositionDuration > 0 else { return }

        var positions: [CGPoint] = []
        var bounds: [CGRect] = []
        var times: [NSNumber] = []
        for key in keys {
            let box = OverlayFrame.fitted(
                CGRect(
                    x: key.box.x * renderSize.width,
                    y: key.box.y * renderSize.height,
                    width: key.box.width * renderSize.width,
                    height: key.box.height * renderSize.height
                ),
                mediaAspect: OverlayFrame.shownAspect(
                    mediaAspect: mediaAspect,
                    crop: overlay.resolvedCrop
                )
            )
            positions.append(
                CGPoint(x: box.midX, y: renderSize.height - box.midY)
            )
            bounds.append(CGRect(origin: .zero, size: box.size))
            let at = (overlay.timelineStart + key.at) / compositionDuration
            times.append(NSNumber(value: min(1, max(0, at))))
        }

        for (keyPath, values) in [
            ("position", positions as [Any]),
            ("bounds", bounds as [Any]),
        ] {
            let animation = CAKeyframeAnimation(keyPath: keyPath)
            animation.values = values
            animation.keyTimes = times
            animation.calculationMode = .linear
            animation.duration = compositionDuration
            animation.beginTime = AVCoreAnimationBeginTimeAtZero
            animation.isRemovedOnCompletion = false
            animation.fillMode = .both
            layer.add(animation, forKey: "overlayMotion.\(keyPath)")
        }
    }

    private static func applyVisibility(
        to layer: CALayer,
        start: Double,
        layerDuration: Double,
        compositionDuration: Double
    ) {
        layer.opacity = 0
        let track = LayerVisibilityKeyframes.make(
            start: start,
            layerDuration: layerDuration,
            compositionDuration: compositionDuration
        )
        let animation = CAKeyframeAnimation(keyPath: "opacity")
        animation.values = track.values
        animation.keyTimes = track.keyTimes.map(NSNumber.init(value:))
        animation.duration = compositionDuration
        animation.beginTime = AVCoreAnimationBeginTimeAtZero
        animation.isRemovedOnCompletion = false
        animation.fillMode = .both
        layer.add(animation, forKey: "timelineVisibility")
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

    static func aspect(of media: ProjectMedia) -> Double {
        Double(max(1, media.width)) / Double(max(1, media.height))
    }

    /// Places an overlay's own video inside `box`, which is measured from the
    /// top left of the frame, the same way the composition's render space is.
    static func overlayTransform(
        naturalSize: CGSize,
        preferredTransform: CGAffineTransform,
        crop: OverlayCrop,
        box: CGRect
    ) -> CGAffineTransform {
        let orientedRect = CGRect(origin: .zero, size: naturalSize)
            .applying(preferredTransform)
        let orientedSize = CGSize(
            width: abs(orientedRect.width),
            height: abs(orientedRect.height)
        )
        guard
            orientedSize.width > 0,
            orientedSize.height > 0,
            box.width > 0,
            box.height > 0
        else { return preferredTransform }

        // The box already has the shape of what the crop kept, so scaling the
        // kept rectangle onto it is a plain fit. The whole picture is scaled by
        // the same amount and slid so that rectangle lands in the box; the crop
        // rectangle on the layer instruction hides the rest.
        let keptSize = CGSize(
            width: max(1, orientedSize.width * crop.width),
            height: max(1, orientedSize.height * crop.height)
        )
        let scale = min(box.width / keptSize.width, box.height / keptSize.height)
        let scaledKept = CGSize(width: keptSize.width * scale, height: keptSize.height * scale)
        // The composition draws from the top left, and so does the crop.
        let keptOrigin = CGPoint(
            x: orientedSize.width * crop.x * scale,
            y: orientedSize.height * crop.y * scale
        )
        return preferredTransform
            .concatenating(
                CGAffineTransform(translationX: -orientedRect.minX, y: -orientedRect.minY)
            )
            .concatenating(CGAffineTransform(scaleX: scale, y: scale))
            .concatenating(
                CGAffineTransform(
                    translationX: box.midX - scaledKept.width / 2 - keptOrigin.x,
                    y: box.midY - scaledKept.height / 2 - keptOrigin.y
                )
            )
    }

    /// Places the main track's picture in the output frame: fitted and centred,
    /// then zoomed and slid by whatever framing the clip carries.
    static func fittedTransform(
        naturalSize: CGSize,
        preferredTransform: CGAffineTransform,
        renderSize: CGSize,
        framing: VideoFraming = .identity
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
        guard !framing.isIdentity else { return transform }

        // Zoom about the middle of the output frame, then slide. Doing it in
        // that order is what keeps a zoom from throwing the picture off to one
        // side, and what lets the offset mean the same thing at every scale.
        // The composition draws from the top left, so a positive offset moves
        // the picture right and down, exactly as it does on the canvas.
        let centreX = renderSize.width / 2
        let centreY = renderSize.height / 2
        return transform
            .concatenating(CGAffineTransform(translationX: -centreX, y: -centreY))
            .concatenating(CGAffineTransform(scaleX: framing.scale, y: framing.scale))
            .concatenating(
                CGAffineTransform(
                    translationX: centreX + framing.x * renderSize.width,
                    y: centreY + framing.y * renderSize.height
                )
            )
    }
}
