import Foundation
import QuartzCore

/// Turns a node's movement into Core Animation keyframes.
///
/// Every keyframe value is read from `SceneTimeline` at one of its sample
/// times. Nothing here interpolates and no Core Animation timing function is
/// used for the curve: the samples are dense enough that the linear run between
/// them is the curve, and the same samples are what the poster reads, so the
/// preview, the export and the library still cannot drift apart.
enum SceneAnimationBaker {
    private static let boxProperties: Set<SceneAnimation.Property> = [.x, .y, .width, .height]
    private static let transformProperties: Set<SceneAnimation.Property> = [.scale, .scaleX, .scaleY, .rotate]

    /// Adds the animations for `entry` and everything under it, beginning at
    /// `beginTime` on the host layer's clock.
    static func bake(_ entry: SceneNodeLayer, timeline: SceneTimeline, beginTime: CFTimeInterval) {
        let animated = timeline.animatedProperties(of: entry.node.id)
        if !animated.isEmpty {
            bakeNode(entry, animated: animated, timeline: timeline, beginTime: beginTime)
        }
        for child in entry.children {
            bake(child, timeline: timeline, beginTime: beginTime)
        }
    }

    private static func bakeNode(
        _ entry: SceneNodeLayer,
        animated: Set<SceneAnimation.Property>,
        timeline: SceneTimeline,
        beginTime: CFTimeInterval
    ) {
        let times = timeline.sampleTimes(perSecond: 60)
        let states = times.map { SceneNodeState.resolve(node: entry.node, timeline: timeline, at: $0) }
        let duration = timeline.duration
        let node = entry.node
        let layer = entry.layer

        func add(_ keyPath: String, _ values: [Any], to target: CALayer) {
            target.add(
                keyframes(keyPath, values: values, times: times, duration: duration, beginTime: beginTime),
                forKey: "scene.\(keyPath)"
            )
        }

        if !animated.isDisjoint(with: boxProperties) {
            let frames = states.map { $0.frame(of: node, parentSize: entry.parentSize) }
            let placements = frames.map {
                SceneGeometry.placement(of: $0, anchor: node.anchor, parentSize: entry.parentSize)
            }
            add("position", placements.map { NSValue(point: $0.position) }, to: layer)
            add("bounds", placements.map { NSValue(rect: $0.bounds) }, to: layer)
            if let shape = entry.shape, let path = entry.path {
                add("path", frames.map { path($0.size) }, to: shape)
            }
            if let hanging = entry.topAnchored {
                let bleed = entry.topAnchoredBleed
                add(
                    "position",
                    frames.map { NSValue(point: SceneNodeLayer.topAnchoredPosition(for: $0.size, bleed: bleed)) },
                    to: hanging
                )
            }
        }

        if !animated.isDisjoint(with: transformProperties) {
            add(
                "transform",
                states.map {
                    NSValue(caTransform3D: SceneGeometry.transform(
                        scaleX: $0.scaleX,
                        scaleY: $0.scaleY,
                        rotate: $0.rotate
                    ))
                },
                to: layer
            )
        }

        if animated.contains(.opacity) {
            add("opacity", states.map { NSNumber(value: $0.opacity) }, to: layer)
        }

        if animated.contains(.strokeEnd), let shape = entry.shape {
            add("strokeEnd", states.map { NSNumber(value: $0.strokeEnd) }, to: shape)
        }

        if animated.contains(.value), let counter = entry.counter {
            bakeCounter(counter, states: states, times: times, duration: duration, beginTime: beginTime,
                        maximumFaces: max(2, 128 / max(1, timeline.animatedCounterCount)))
        }
    }

    /// A counter's digits swap rather than blend, so its faces go on as a
    /// discrete animation with a keyframe wherever the string changes.
    private static func bakeCounter(
        _ counter: SceneCounterFace,
        states: [SceneNodeState],
        times: [Double],
        duration: Double,
        beginTime: CFTimeInterval,
        maximumFaces: Int
    ) {
        var faces: [Any] = []
        var changes: [Double] = []
        var last: String?
        // Each face is at most ~512 KiB. Share ~64 MiB across animated
        // counters, sampling evenly and always retaining both endpoints.
        var candidates: [Int] = []
        var previousText: String?
        for index in states.indices {
            let text = counter.string(at: states[index].value)
            if text != previousText { candidates.append(index); previousText = text }
        }
        let indices = counterSampleIndices(count: candidates.count, maximumFaces: maximumFaces)
        for candidate in indices {
            let index = candidates[candidate]
            let state = states[index]
            let time = times[index]
            let text = counter.string(at: state.value)
            guard text != last else { continue }
            guard let image = counter.image(for: text) else { continue }
            faces.append(image)
            changes.append(time)
            last = text
        }
        guard faces.count > 1 else { return }
        let animation = CAKeyframeAnimation(keyPath: "contents")
        animation.values = faces
        // A discrete run names the moment each value starts and ends with
        // the moment the last one stops, which is the end of the scene.
        animation.keyTimes = (changes.map { $0 / max(0.000_1, duration) } + [1]).map { NSNumber(value: min(1, max(0, $0))) }
        animation.calculationMode = .discrete
        animation.duration = duration
        animation.beginTime = beginTime
        animation.fillMode = .both
        animation.isRemovedOnCompletion = false
        counter.layer.add(animation, forKey: "scene.contents")
    }

    static func counterSampleIndices(count: Int, maximumFaces: Int) -> [Int] {
        guard count > 0 else { return [] }
        let limit = min(count, max(2, maximumFaces))
        guard limit > 1 else { return [0] }
        return (0..<limit).map { Int((Double($0) * Double(count - 1) / Double(limit - 1)).rounded()) }
    }

    static func keyframes(
        _ keyPath: String,
        values: [Any],
        times: [Double],
        duration: Double,
        beginTime: CFTimeInterval
    ) -> CAKeyframeAnimation {
        let animation = CAKeyframeAnimation(keyPath: keyPath)
        animation.values = values
        animation.keyTimes = times.map { NSNumber(value: min(1, max(0, $0 / max(0.000_1, duration)))) }
        animation.calculationMode = .linear
        animation.duration = duration
        animation.beginTime = beginTime
        animation.fillMode = .both
        animation.isRemovedOnCompletion = false
        return animation
    }
}
