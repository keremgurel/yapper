import Foundation

/// The one place a scene's animated values are worked out.
///
/// The preview, the export and the library poster all ask this for a
/// property's value at a moment, so a counter that reads 2,850 at 1.6 seconds
/// in the preview reads 2,850 at 1.6 seconds in the file. The export bakes the
/// answers into Core Animation keyframes; the poster reads one moment; the
/// preview scrubs the same keyframes. None of them interpolate on their own.
struct SceneTimeline: Sendable {
    /// One animation, expanded onto one node with its stagger applied.
    struct Segment: Equatable, Sendable {
        let from: Double?
        let to: Double
        let start: Double
        let end: Double
        let easing: SceneEasing
    }

    let duration: Double
    let animatedCounterCount: Int
    private let segments: [String: [SceneAnimation.Property: [Segment]]]

    init(scene: OverlayScene) {
        duration = scene.duration
        var table: [String: [SceneAnimation.Property: [Segment]]] = [:]
        for animation in scene.animations {
            let targets = animation.targetsEveryNode
                ? scene.nodes
                : SceneValidator.findTargets(scene.nodes, id: animation.node)
            for (index, target) in targets.enumerated() {
                let offset = animation.stagger * Double(index)
                let segment = Segment(
                    from: animation.from,
                    to: animation.to,
                    start: animation.start + offset,
                    end: animation.end + offset,
                    easing: animation.easing
                )
                table[target.id, default: [:]][animation.property, default: []].append(segment)
            }
        }
        for (id, properties) in table {
            for (property, list) in properties {
                table[id]?[property] = list.sorted { $0.start < $1.start }
            }
        }
        segments = table
        animatedCounterCount = scene.allNodes.filter { $0.kind == .number && table[$0.id]?[.value] != nil }.count
    }

    /// The properties anything animates on this node.
    func animatedProperties(of nodeID: String) -> Set<SceneAnimation.Property> {
        Set(segments[nodeID]?.keys ?? [:].keys)
    }

    func isAnimated(_ property: SceneAnimation.Property, of nodeID: String) -> Bool {
        segments[nodeID]?[property] != nil
    }

    /// The value of `property` on the node at `time`, given the node's own
    /// resting value. Before the first segment the value is that segment's
    /// `from` (or the resting value); between segments it holds the previous
    /// segment's `to`; after the last it holds the last `to`.
    func value(
        _ property: SceneAnimation.Property,
        of nodeID: String,
        at time: Double,
        resting: Double
    ) -> Double {
        guard let list = segments[nodeID]?[property], !list.isEmpty else { return resting }
        var current = resting
        for (index, segment) in list.enumerated() {
            let from = segment.from ?? current
            if time < segment.start {
                return index == 0 ? from : current
            }
            if time >= segment.end {
                current = segment.to
                continue
            }
            let progress = (time - segment.start) / max(0.000_1, segment.end - segment.start)
            return from + (segment.to - from) * segment.easing.apply(progress)
        }
        return current
    }

    /// The moments an export should sample, dense enough that no easing curve
    /// is visibly polygonal, plus every segment boundary so a hold starts on
    /// exactly the right frame.
    func sampleTimes(perSecond rate: Double = 60) -> [Double] {
        var times: Set<Double> = [0, duration]
        let step = 1 / max(1, rate)
        var cursor = 0.0
        while cursor < duration {
            times.insert((cursor * 10_000).rounded() / 10_000)
            cursor += step
        }
        for properties in segments.values {
            for list in properties.values {
                for segment in list {
                    times.insert(min(duration, segment.start))
                    times.insert(min(duration, segment.end))
                }
            }
        }
        return times.sorted()
    }

    /// Whether anything in the scene changes over time at all. A still scene
    /// can be drawn once and left alone.
    var isAnimated: Bool { !segments.isEmpty }
}
