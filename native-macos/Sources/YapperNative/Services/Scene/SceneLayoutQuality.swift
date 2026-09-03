import AppKit
import Foundation

/// Final pre-insertion check using the same fonts, Core Text measurements and
/// animation timeline as preview/export. Rejects broken geometry, never silently
/// changes the model's font sizes. Transparent sequential reveals remain valid.
enum SceneLayoutQuality {
    /// Core Text can wrap differently from the backend's conservative estimate.
    /// Give glyphs their intrinsic height without changing font sizes, widths or
    /// positions. The complete collision/bounds check MUST still run afterward:
    /// this is only safe when that extra height fits the space already available.
    static func fittingTextBoxes(scene: OverlayScene, size: CGSize) -> OverlayScene {
        let timeline = SceneTimeline(scene: scene)
        func fit(_ nodes: [SceneNode], parentSize: CGSize, animatedParent: Bool) -> [SceneNode] {
            nodes.map { original in
                var node = original
                let animatedGeometry = animatedParent || timeline.isAnimated(.width, of: node.id)
                    || timeline.isAnimated(.height, of: node.id)
                let frameSize = CGSize(width: node.width * parentSize.width, height: node.height * parentSize.height)
                if node.kind == .group {
                    node.children = fit(node.children ?? [], parentSize: frameSize, animatedParent: animatedGeometry)
                } else if node.isTypographic && !animatedGeometry && parentSize.height > 0 {
                    let fontSize = CGFloat(node.size ?? 0.12) * size.height
                    let style = SceneTextRasterizer.Style(
                        font: SceneFontResolver.font(node.font ?? .modern, weight: node.weight ?? .bold, size: fontSize),
                        color: NSColor.black.cgColor, align: node.align ?? .left,
                        lineHeight: fontSize * CGFloat(node.lineHeight ?? 1.15))
                    let texts = node.kind == .number
                        ? [0.0, 0.5, 1.0].map { SceneCounterFace.string(for: node, progress: $0) }
                        : [node.uppercase == true ? (node.text ?? "").uppercased() : node.text ?? ""]
                    let needed = texts.map {
                        SceneTextRasterizer.measure($0, style: style, width: max(1, frameSize.width), maximumHeight: 100_000).height
                    }.max() ?? 0
                    if needed > frameSize.height {
                        node.height = min(1.5, max(node.height, ceil(needed + 1) / parentSize.height))
                    }
                }
                return node
            }
        }
        var fitted = scene
        fitted.nodes = fit(scene.nodes, parentSize: size, animatedParent: false)
        return fitted
    }

    static func issues(scene: OverlayScene, size: CGSize, frameHeight: CGFloat = 1080) -> [String] {
        let timeline = SceneTimeline(scene: scene)
        var issues = Set<String>()
        struct Ink { let id: String; let rect: CGRect }
        let samples = Set(timeline.sampleTimes(perSecond: 4) + [scene.poster])
        for time in samples.sorted() {
            var inks: [Ink] = []
            func visit(_ nodes: [SceneNode], parentSize: CGSize, transform: CGAffineTransform, opacity: Double) {
                for node in nodes {
                    let state = SceneNodeState.resolve(node: node, timeline: timeline, at: time)
                    let alpha = opacity * state.opacity
                    guard alpha >= 0.85 else { continue }
                    let frame = state.frame(of: node, parentSize: parentSize)
                    let anchor = node.anchor.unitPoint
                    let pivot = CGPoint(x: frame.width * anchor.x, y: frame.height * anchor.y)
                    let local = CGAffineTransform(translationX: -pivot.x, y: -pivot.y)
                        .concatenating(CGAffineTransform(scaleX: state.scaleX, y: state.scaleY))
                        .concatenating(CGAffineTransform(rotationAngle: state.rotate * .pi / 180))
                        .concatenating(CGAffineTransform(translationX: frame.minX + pivot.x, y: frame.minY + pivot.y))
                        .concatenating(transform)
                    if node.kind == .group {
                        visit(node.children ?? [], parentSize: frame.size, transform: local, opacity: alpha)
                        continue
                    }
                    guard node.kind == .text || node.kind == .number else { continue }
                    let fontSize = CGFloat(node.size ?? 0.12) * size.height
                    if fontSize < frameHeight * SceneLimits.minLegibleFrameFraction - 0.1 {
                        issues.insert("\(node.id): text is too small for the finished video.")
                    }
                    let style = SceneTextRasterizer.Style(
                        font: SceneFontResolver.font(node.font ?? .modern, weight: node.weight ?? .bold, size: fontSize),
                        color: NSColor.black.cgColor, align: node.align ?? .left,
                        lineHeight: fontSize * CGFloat(node.lineHeight ?? 1.15))
                    let texts = node.kind == .number
                        ? [0.0, 0.5, 1.0].map { SceneCounterFace.string(for: node, progress: $0) }
                        : [node.uppercase == true ? (node.text ?? "").uppercased() : node.text ?? ""]
                    var height: CGFloat = 0
                    for text in texts {
                        let measured = SceneTextRasterizer.measure(text, style: style, width: max(1, frame.width), maximumHeight: 100_000)
                        height = max(height, measured.height)
                        if node.kind == .number {
                            let width = (text as NSString).size(withAttributes: [.font: style.font]).width
                            if width > frame.width + 1 { issues.insert("\(node.id): the counter does not fit on one line.") }
                        }
                    }
                    if height > frame.height + 2 { issues.insert("\(node.id): text overflows its allocated height.") }
                    let rect = CGRect(x: 0, y: 0, width: frame.width, height: height).applying(local)
                    if !CGRect(origin: .zero, size: size).insetBy(dx: -2, dy: -2).contains(rect) {
                        issues.insert("\(node.id): text extends outside the overlay.")
                    }
                    inks.append(Ink(id: node.id, rect: rect))
                }
            }
            visit(scene.nodes, parentSize: size, transform: .identity, opacity: 1)
            for i in inks.indices {
                for j in inks.indices where j > i {
                    let intersection = inks[i].rect.intersection(inks[j].rect)
                    if !intersection.isNull && intersection.width > 2 && intersection.height > 2 {
                        issues.insert("\(inks[i].id) overlaps \(inks[j].id).")
                    }
                }
            }
        }
        return issues.sorted()
    }
}
