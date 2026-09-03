import Foundation
import CoreFoundation

/// Turns a scene as it arrived over the wire into one the renderer can draw.
///
/// The server has already run the same rules, but this is a model's design
/// arriving from a network, and the renderer is the thing that must never be
/// handed nonsense. Repairs where a repair is harmless (a fraction out of
/// range is clamped), drops where it is not (an icon that does not exist),
/// and says so in `notes`. Rejects the scene only when nothing drawable is
/// left. Mirrors `scene-validate.ts`; docs/overlay-scene-format.md is the
/// contract.
enum SceneValidator {
    struct Options: Sendable {
        /// Image keys the design reply actually delivered.
        var imageKeys: Set<String> = []
        var hasBrandLogo: Bool = true
        /// Heights for the legibility floor; either missing skips it.
        var frameHeightPx: Double?
        var boxHeightPx: Double?

        init(imageKeys: Set<String> = [], frameHeightPx: Double? = nil, boxHeightPx: Double? = nil, hasBrandLogo: Bool = true) {
            self.imageKeys = imageKeys
            self.hasBrandLogo = hasBrandLogo
            self.frameHeightPx = frameHeightPx
            self.boxHeightPx = boxHeightPx
        }
    }

    struct Result: Equatable, Sendable {
        let scene: OverlayScene
        let notes: [String]
    }

    static func validate(json data: Data, options: Options = Options()) -> Result? {
        guard let object = try? JSONSerialization.jsonObject(with: data) else { return nil }
        return validate(object, options: options)
    }

    static func validate(_ value: Any, options: Options = Options()) -> Result? {
        guard let raw = value as? [String: Any] else { return nil }
        if let version = number(raw["version"]), version > Double(SceneLimits.version) { return nil }
        guard let rawDuration = number(raw["duration"]) else { return nil }
        let duration = clamp(rawDuration, SceneLimits.duration)
        var budget = Budget(options: options)

        let nodes = (raw["nodes"] as? [Any] ?? []).enumerated().compactMap { index, node in
            validateNode(node, index: index, depth: 0, budget: &budget)
        }
        guard !nodes.isEmpty else { return nil }

        var remaining = SceneLimits.maxAnimations
        var animations: [SceneAnimation] = []
        for entry in raw["animations"] as? [Any] ?? [] {
            guard let animation = validateAnimation(entry, nodes: nodes, duration: duration, budget: &budget) else {
                continue
            }
            let cost = copies(of: animation, in: nodes)
            if cost > remaining {
                budget.note("Left out animations past the limit of \(SceneLimits.maxAnimations).")
                break
            }
            remaining -= cost
            animations.append(animation)
        }

        var background: OverlayScene.Background?
        if let rawBackground = raw["background"] as? [String: Any],
           let fill = color(rawBackground["fill"])
        {
            background = OverlayScene.Background(
                fill: fill,
                cornerRadius: number(rawBackground["cornerRadius"], default: 0, in: 0 ... 0.5),
                opacity: number(rawBackground["opacity"], default: 1, in: 0 ... 1)
            )
        }

        let scene = OverlayScene(
            duration: duration,
            poster: number(raw["poster"], default: duration * SceneLimits.defaultPosterFraction, in: 0 ... duration),
            background: background,
            nodes: nodes,
            animations: animations
        )
        return Result(scene: scene, notes: budget.notes)
    }

    // MARK: - Nodes

    private struct Budget {
        let options: Options
        var nodes = 0
        var images = 0
        var notes: [String] = []
        var ids: Set<String> = []

        init(options: Options) { self.options = options }

        mutating func note(_ text: String) {
            if notes.count < 12 && !notes.contains(text) { notes.append(text) }
        }

        mutating func uniqueID(_ raw: Any?, index: Int) -> String {
            var id = (raw as? String).flatMap { Self.isValidID($0) ? $0 : nil } ?? "node\(index + 1)"
            var n = 2
            while ids.contains(id) {
                id = "\(id)-\(n)"
                n += 1
            }
            ids.insert(id)
            return id
        }

        static func isValidID(_ value: String) -> Bool {
            !value.isEmpty
                && value.count <= SceneLimits.maxIdLength
                && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }
                && value.allSatisfy(\.isASCII)
        }
    }

    private static func validateNode(_ value: Any, index: Int, depth: Int, budget: inout Budget) -> SceneNode? {
        guard let raw = value as? [String: Any] else { return nil }
        if budget.nodes >= SceneLimits.maxNodes {
            budget.note("Left out nodes past the limit of \(SceneLimits.maxNodes).")
            return nil
        }
        let id = budget.uniqueID(raw["id"], index: index)
        let type = raw["type"] as? String ?? ""

        var node: SceneNode?
        switch type {
        case "text":
            guard var base = base(raw, id: id, kind: .text, autoHeight: true) else { break }
            let text = string(raw["text"], max: SceneLimits.maxTextLength)
            guard !text.isEmpty else { break }
            if let original = raw["text"] as? String,
               original.trimmingCharacters(in: .whitespacesAndNewlines).count > SceneLimits.maxTextLength
            {
                budget.note("Shortened \"\(id)\" to \(SceneLimits.maxTextLength) characters.")
            }
            applyTypeFields(&base, raw, budget: &budget)
            base.text = text
            if base.height <= 0 { base.height = (base.size ?? 0.12) * (base.lineHeight ?? 1.15) * 1.2 }
            node = base
        case "number":
            guard var base = base(raw, id: id, kind: .number, autoHeight: true),
                  let from = number(raw["from"]), let to = number(raw["to"])
            else { break }
            applyTypeFields(&base, raw, budget: &budget)
            base.from = from
            base.to = to
            base.format = enumValue(raw["format"], default: SceneNode.NumberFormat.grouped)
            base.prefix = string(raw["prefix"], max: 8)
            base.suffix = string(raw["suffix"], max: 8)
            if base.height <= 0 { base.height = (base.size ?? 0.12) * (base.lineHeight ?? 1.15) * 1.2 }
            node = base
        case "rect":
            guard var base = base(raw, id: id, kind: .rect, autoHeight: false) else { break }
            let fill = color(raw["fill"])
            let stroke = color(raw["stroke"])
            base.fill = fill ?? (stroke == nil ? .token(.primary) : nil)
            base.stroke = stroke
            base.strokeWidth = number(raw["strokeWidth"], default: 0.01, in: SceneLimits.strokeWidth)
            base.cornerRadius = number(raw["cornerRadius"], default: 0, in: SceneLimits.cornerRadius)
            node = base
        case "ellipse":
            guard var base = base(raw, id: id, kind: .ellipse, autoHeight: false) else { break }
            let fill = color(raw["fill"])
            let stroke = color(raw["stroke"])
            base.fill = fill ?? (stroke == nil ? .token(.primary) : nil)
            base.stroke = stroke
            base.strokeWidth = number(raw["strokeWidth"], default: 0.01, in: SceneLimits.strokeWidth)
            node = base
        case "line":
            guard let x = number(raw["x"]), let y = number(raw["y"]),
                  let x2 = number(raw["x2"]), let y2 = number(raw["y2"])
            else { break }
            let a = (clamp(x, SceneLimits.position), clamp(y, SceneLimits.position))
            let b = (clamp(x2, SceneLimits.position), clamp(y2, SceneLimits.position))
            var line = SceneNode(
                id: id,
                kind: .line,
                x: a.0,
                y: a.1,
                width: max(SceneLimits.size.lowerBound, abs(b.0 - a.0)),
                height: max(SceneLimits.size.lowerBound, abs(b.1 - a.1)),
                opacity: number(raw["opacity"], default: 1, in: 0 ... 1)
            )
            line.x2 = b.0
            line.y2 = b.1
            line.stroke = color(raw["stroke"]) ?? .token(.ink)
            line.strokeWidth = number(raw["strokeWidth"], default: 0.01, in: SceneLimits.strokeWidth)
            line.dashed = raw["dashed"] as? Bool == true
            node = line
        case "path":
            guard var base = base(raw, id: id, kind: .path, autoHeight: false) else { break }
            let d = (raw["d"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !d.isEmpty, d.utf8.count <= SceneLimits.maxPathBytes, isPathData(d) else {
                budget.note("Dropped \"\(id)\": its path data could not be read.")
                break
            }
            let fill = color(raw["fill"])
            let stroke = color(raw["stroke"])
            base.d = d
            base.fill = fill
            base.stroke = stroke ?? (fill == nil ? .token(.ink) : nil)
            base.strokeWidth = number(raw["strokeWidth"], default: 0.01, in: SceneLimits.strokeWidth)
            node = base
        case "icon":
            guard var base = base(raw, id: id, kind: .icon, autoHeight: false) else { break }
            let name = raw["icon"] as? String ?? ""
            guard SceneIconCatalog.shared.contains(name) else {
                budget.note("Dropped \"\(id)\": there is no icon called \"\(string(name, max: 40).isEmpty ? "?" : string(name, max: 40))\".")
                break
            }
            base.icon = name
            base.color = color(raw["color"]) ?? .token(.ink)
            base.strokeWidth = number(raw["strokeWidth"], default: 0.02, in: SceneLimits.strokeWidth)
            node = base
        case "image":
            guard var base = base(raw, id: id, kind: .image, autoHeight: false) else { break }
            let asset = string(raw["asset"], max: 60)
            guard isAllowedAsset(asset, options: budget.options) else {
                budget.note("Dropped \"\(id)\": it pointed at a picture that was not delivered.")
                break
            }
            guard budget.images < SceneLimits.maxImages else {
                budget.note("Dropped \"\(id)\": a scene may hold \(SceneLimits.maxImages) pictures.")
                break
            }
            budget.images += 1
            base.asset = asset
            base.fit = enumValue(raw["fit"], default: SceneNode.ImageFit.contain)
            base.cornerRadius = number(raw["cornerRadius"], default: 0, in: SceneLimits.cornerRadius)
            node = base
        case "group":
            guard var base = base(raw, id: id, kind: .group, autoHeight: false) else { break }
            guard depth < SceneLimits.maxGroupDepth else {
                budget.note("Dropped \"\(id)\": groups nest \(SceneLimits.maxGroupDepth) deep at most.")
                break
            }
            budget.nodes += 1
            let children = (raw["children"] as? [Any] ?? []).enumerated().compactMap { index, child in
                validateNode(child, index: index, depth: depth + 1, budget: &budget)
            }
            guard !children.isEmpty else {
                budget.nodes -= 1
                break
            }
            base.children = children
            return base
        default:
            let shown = string(type, max: 24)
            budget.note("Dropped \"\(id)\": \"\(shown.isEmpty ? "?" : shown)\" is not a node type.")
        }
        if node != nil { budget.nodes += 1 }
        return node
    }

    private static func base(_ raw: [String: Any], id: String, kind: SceneNode.Kind, autoHeight: Bool) -> SceneNode? {
        guard let width = number(raw["width"]) else { return nil }
        let height = number(raw["height"])
        guard height != nil || autoHeight else { return nil }
        return SceneNode(
            id: id,
            kind: kind,
            x: number(raw["x"], default: 0, in: SceneLimits.position),
            y: number(raw["y"], default: 0, in: SceneLimits.position),
            width: clamp(width, SceneLimits.size),
            height: height.map { clamp($0, SceneLimits.size) } ?? 0,
            opacity: number(raw["opacity"], default: 1, in: 0 ... 1),
            rotate: number(raw["rotate"], default: 0, in: -360 ... 360),
            anchor: enumValue(raw["anchor"], default: SceneNode.Anchor.center)
        )
    }

    private static func applyTypeFields(_ node: inout SceneNode, _ raw: [String: Any], budget: inout Budget) {
        node.font = enumValue(raw["font"], default: SceneNode.Font.modern)
        node.weight = enumValue(raw["weight"], default: SceneNode.Weight.bold)
        node.size = legible(number(raw["size"], default: 0.12, in: SceneLimits.textSize), budget: &budget)
        node.color = color(raw["color"]) ?? .token(.ink)
        node.align = enumValue(raw["align"], default: SceneNode.Align.left)
        node.lineHeight = number(raw["lineHeight"], default: 1.15, in: SceneLimits.lineHeight)
        node.uppercase = raw["uppercase"] as? Bool == true
    }

    private static func legible(_ size: Double, budget: inout Budget) -> Double {
        guard let frame = budget.options.frameHeightPx, let box = budget.options.boxHeightPx,
              frame > 0, box > 0
        else { return size }
        let floor = SceneLimits.minLegibleFrameFraction * frame / box
        guard size < floor else { return size }
        budget.note("Text is below the readable size and needs redesign.")
        return size
    }

    private static func isAllowedAsset(_ asset: String, options: Options) -> Bool {
        if asset == "brand.logo" { return options.hasBrandLogo }
        guard asset.hasPrefix("image:") else { return false }
        let key = String(asset.dropFirst("image:".count))
        return Budget.isValidID(key) && options.imageKeys.contains(key)
    }

    private static func isPathData(_ d: String) -> Bool {
        let allowed = Set("MmZzLlHhVvCcSsQqTtAa0123456789 \t\n\r,.-+eE")
        return d.allSatisfy { allowed.contains($0) }
    }

    // MARK: - Animations

    private static func validateAnimation(
        _ value: Any,
        nodes: [SceneNode],
        duration: Double,
        budget: inout Budget
    ) -> SceneAnimation? {
        guard let raw = value as? [String: Any],
              let property = (raw["property"] as? String).flatMap(SceneAnimation.Property.init(rawValue:)),
              let target = raw["node"] as? String
        else { return nil }
        let targets = target == SceneAnimation.everyNode ? nodes : findTargets(nodes, id: target)
        guard !targets.isEmpty else { return nil }
        if property == .value, targets.contains(where: { $0.kind != .number }) {
            budget.note("Skipped a \"value\" animation on a node that has no value.")
            return nil
        }
        if property == .strokeEnd, targets.contains(where: { !$0.canStroke }) {
            budget.note("Skipped a \"strokeEnd\" animation on a node that has no strokeEnd.")
            return nil
        }
        guard let to = number(raw["to"]) else { return nil }
        let start = number(raw["start"], default: 0, in: 0 ... duration)
        let end = number(raw["end"], default: duration, in: 0 ... duration)
        guard end > start else { return nil }
        return SceneAnimation(
            node: target,
            property: property,
            from: number(raw["from"]),
            to: to,
            start: start,
            end: end,
            easing: enumValue(raw["easing"], default: SceneEasing.default),
            stagger: number(raw["stagger"], default: 0, in: SceneLimits.stagger)
        )
    }

    /// The nodes an animation reaches: a group's children for a group id.
    static func findTargets(_ nodes: [SceneNode], id: String) -> [SceneNode] {
        for node in nodes {
            if node.id == id { return node.kind == .group ? (node.children ?? []) : [node] }
            if let children = node.children {
                let found = findTargets(children, id: id)
                if !found.isEmpty { return found }
            }
        }
        return []
    }

    private static func copies(of animation: SceneAnimation, in nodes: [SceneNode]) -> Int {
        guard animation.stagger > 0 else { return 1 }
        return animation.targetsEveryNode
            ? nodes.count
            : max(1, findTargets(nodes, id: animation.node).count)
    }

    // MARK: - Reading values

    private static func number(_ value: Any?) -> Double? {
        // NSNumber(0/1) also bridges to Bool in Swift. Check its actual JSON
        // type, otherwise opacity/value animations vanish on network decode.
        guard let number = value as? NSNumber,
              CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
        let double = number.doubleValue
        return double.isFinite ? double : nil
    }

    private static func number(_ value: Any?, default fallback: Double, in range: ClosedRange<Double>) -> Double {
        guard let parsed = number(value) else { return fallback }
        return clamp(parsed, range)
    }

    private static func clamp(_ value: Double, _ range: ClosedRange<Double>) -> Double {
        min(range.upperBound, max(range.lowerBound, value))
    }

    private static func string(_ value: Any?, max: Int) -> String {
        guard let string = value as? String else { return "" }
        return String(string.trimmingCharacters(in: .whitespacesAndNewlines).prefix(max))
    }

    private static func color(_ value: Any?) -> SceneColor? {
        (value as? String).flatMap(SceneColor.init)
    }

    private static func enumValue<T: RawRepresentable>(_ value: Any?, default fallback: T) -> T
        where T.RawValue == String
    {
        (value as? String).flatMap(T.init(rawValue:)) ?? fallback
    }
}
