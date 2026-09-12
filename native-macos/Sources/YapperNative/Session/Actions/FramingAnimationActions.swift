import CoreGraphics
import Foundation

enum FramingAnimationTrack {
    static func focused(_ framing: VideoFraming, amount: Double, face: CGRect?, sourceAspect: Double, frameAspect: Double) -> VideoFraming {
        let scale = min(VideoFraming.maximumScale, framing.scale * amount)
        guard let face else { return framing.with(scale: scale) }
        // Keep the detected face at its current on-screen point as the picture grows.
        let fittedWidth = min(1, sourceAspect / frameAspect)
        let fittedHeight = min(1, frameAspect / sourceAspect)
        let dx = (face.midX - 0.5) * fittedWidth
        let dy = (face.midY - 0.5) * fittedHeight
        let angle = framing.rotationRadians
        let rotatedX = dx * cos(angle) - dy * sin(angle) / frameAspect
        let rotatedY = dx * sin(angle) * frameAspect + dy * cos(angle)
        return framing.with(scale: scale, x: framing.x - (scale - framing.scale) * rotatedX,
                            y: framing.y - (scale - framing.scale) * rotatedY)
    }

}

struct ResolvedFramingKey {
    let time: Double
    let scale: Double
    var x: Double = 0
    var y: Double = 0
    var rotation: Double = 0
    var easing: AnimationEase = .linear
}

extension FramingAnimationTrack {
    static func applying(to clip: TimelineClip, clipStart: Double, keys authored: [ResolvedFramingKey],
                         face: CGRect?, sourceAspect: Double, frameAspect: Double) -> TimelineClip {
        let lower = max(authored[0].time, clipStart), upper = min(authored.last!.time, clipStart + clip.duration)
        guard upper > lower else { return clip }
        func source(_ time: Double) -> Double { clip.sourceTime(atOffset: time - clipStart) }
        func baseline(_ time: Double) -> VideoFraming {
            VideoFramingTrack.framing(of: clip, atSource: min(clip.sourceEnd, max(clip.sourceStart, source(time))))
        }
        let frames = authored.map { key in
            let base = baseline(key.time)
            let scaled = focused(base, amount: key.scale, face: face, sourceAspect: sourceAspect, frameAspect: frameAspect)
            return scaled.with(x: scaled.x + key.x, y: scaled.y + key.y, rotation: scaled.rotation + key.rotation)
        }
        func segment(_ time: Double) -> Int {
            authored.indices.dropLast().first { time < authored[$0 + 1].time - 1e-9 } ?? authored.count - 2
        }
        func value(_ time: Double) -> VideoFraming {
            let i = segment(time), a = authored[i], b = authored[i + 1]
            let t = max(0, min(1, (time - a.time) / (b.time - a.time)))
            return VideoFramingTrack.interpolated(from: frames[i], to: frames[i + 1],
                progress: a.easing == .smooth ? SceneEasing.inOutCubic.apply(t) : t)
        }
        var result = VideoFramingTrack.setting(baseline(lower), atSource: source(lower), in: clip, matchingWithin: 1e-9)
        result = VideoFramingTrack.setting(baseline(upper), atSource: source(upper), in: result, matchingWithin: 1e-9)
        if !VideoFramingTrack.isKeyed(clip), source(lower) > clip.sourceStart + 1e-9 {
            result = VideoFramingTrack.setting(clip.resolvedFraming, atSource: clip.sourceStart, in: result, matchingWithin: 1e-9)
        }
        let captured = VideoFramingTrack.keys(of: result)
        var keys = captured.filter { $0.at < source(lower) - 1e-9 || $0.at > source(upper) + 1e-9 }
        let times = Set([lower, upper] + authored.map(\.time).filter { $0 > lower && $0 < upper }).sorted()
        for (index, time) in times.enumerated() {
            var key = FramingKey(at: source(time), framing: value(time))
            if index + 1 < times.count {
                let i = segment(time), a = authored[i], b = authored[i + 1]
                if a.easing == .smooth {
                    key.easing = .init(lower: (time - a.time) / (b.time - a.time), upper: (times[index + 1] - a.time) / (b.time - a.time))
                }
            } else { key.easing = captured.first { abs($0.at - source(upper)) < 1e-9 }?.easing }
            keys.append(key)
        }
        result.framingKeys = keys.sorted { $0.at < $1.at }
        result.framing = result.framingKeys?.first?.framing
        return result
    }
}

extension AppActionRegistry {
    func registerFramingAnimation() {
        register(FramingAnimationInput.self, availability: { session in
            session.project.clips.isEmpty ? .init(reason: "Add footage before animating its framing.") : .available
        }) { session, input in
            let project = session.project
            var keys: [ResolvedFramingKey] = []
            for key in input.keys {
                keys.append(.init(time: try await session.resolveTimelineAnchor(key.at), scale: key.scaleMultiplier,
                    x: key.x ?? 0, y: key.y ?? 0, rotation: key.rotation ?? 0, easing: key.easing ?? .linear))
            }
            guard keys[0].time >= 0, keys.last!.time <= project.duration,
                  zip(keys, keys.dropFirst()).allSatisfy({ $1.time - $0.time >= 0.02 - 1e-9 }),
                  !project.isVideoTrackHidden else {
                throw AppActionError("Place ordered keyframes at least 0.02 seconds apart inside the visible video track.")
            }
            let start = keys[0].time, end = keys.last!.time
            var cursor = 0.0, replacements: [UUID: TimelineClip] = [:]
            var centered = false
            for clip in project.clips {
                defer { cursor += clip.duration }
                guard cursor < end - 1e-9, cursor + clip.duration > start + 1e-9 else { continue }
                guard !clip.locked else { throw AppActionError("Unlock the affected clip before animating its framing.") }
                guard let media = project.media(for: clip), !media.isImage else {
                    throw AppActionError("This framing animation crosses a still image. Animate a video-only interval.")
                }
                let sample = clip.sourceTime(atOffset: max(0, start - cursor))
                var face: CGRect?
                if input.pivot == .face {
                    let faces = await session.faceDetectionService.faces(in: media, at: [sample], faceOnly: true)
                    try Task.checkCancellation()
                    face = faces.values.first?.max(by: { $0.width * $0.height < $1.width * $1.height })
                    centered = centered || face == nil
                }
                for (index, key) in keys.enumerated() where
                    (index == 0 ? key.time : keys[index - 1].time) <= cursor + clip.duration &&
                    (index == keys.count - 1 ? key.time : keys[index + 1].time) >= cursor {
                    let source = min(clip.sourceEnd, max(clip.sourceStart, clip.sourceTime(atOffset: key.time - cursor)))
                    let frame = VideoFramingTrack.framing(of: clip, atSource: source)
                    guard (VideoFraming.minimumScale...VideoFraming.maximumScale).contains(frame.scale * key.scale) else {
                        throw AppActionError("A keyframe exceeds the supported video scale. Choose a smaller scale change.")
                    }
                }
                replacements[clip.id] = FramingAnimationTrack.applying(to: clip, clipStart: cursor, keys: keys, face: face,
                    sourceAspect: CompositionBuilder.aspect(of: media), frameAspect: project.resolvedAspectRatio)
            }
            session.updateProject { $0.clips = $0.clips.map { replacements[$0.id] ?? $0 } }
            let message = String(format: "Framing keyframes saved from %.2fs to %.2fs", start, end)
                + (centered ? " · used the framing center where no face was detected" : "")
            return .init(message: message, changes: replacements.keys.sorted { $0.uuidString < $1.uuidString }.map {
                .init(targetID: $0, property: "framingKeys", before: "Previous framing keys", after: message)
            })
        }
    }
}
