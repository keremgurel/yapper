import Foundation

/// The Lucide icons a scene may name, read once from the bundled resource
/// `scripts/scene-icons/build.mjs` writes.
///
/// Holds the SVG elements as data. Turning them into paths is the renderer's
/// job (`SceneIconPath`); this only has to answer "does this icon exist" for
/// the validator and hand over the shapes for the ones that do.
struct SceneIconCatalog: Sendable {
    /// One SVG element of an icon: `path`, `circle`, `rect`, `line`,
    /// `polyline`, `polygon` or `ellipse`, with its attributes as written.
    struct Element: Equatable, Sendable {
        let tag: String
        let attributes: [String: String]
    }

    /// The side of the square every icon is drawn in.
    let viewBox: Double
    private let shapes: [String: [Element]]

    static let shared: SceneIconCatalog = load()

    var names: Set<String> { Set(shapes.keys) }
    var count: Int { shapes.count }

    func contains(_ name: String) -> Bool { shapes[name] != nil }

    func elements(named name: String) -> [Element]? { shapes[name] }

    init(viewBox: Double, shapes: [String: [Element]]) {
        self.viewBox = viewBox
        self.shapes = shapes
    }

    private static func load() -> SceneIconCatalog {
        guard
            let url = Bundle.module.url(
                forResource: "lucide-icons",
                withExtension: "json",
                subdirectory: "SceneIcons"
            ),
            let data = try? Data(contentsOf: url),
            let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let icons = root["icons"] as? [String: [[Any]]]
        else {
            // A build without the resource can still validate and draw
            // everything except icons; the validator drops them with a note.
            return SceneIconCatalog(viewBox: 24, shapes: [:])
        }
        let viewBox = (root["viewBox"] as? NSNumber)?.doubleValue ?? 24
        var shapes: [String: [Element]] = [:]
        shapes.reserveCapacity(icons.count)
        for (name, nodes) in icons {
            let elements = nodes.compactMap { node -> Element? in
                guard
                    node.count == 2,
                    let tag = node[0] as? String,
                    let raw = node[1] as? [String: Any]
                else { return nil }
                var attributes: [String: String] = [:]
                for (key, value) in raw {
                    if let string = value as? String {
                        attributes[key] = string
                    } else if let number = value as? NSNumber {
                        attributes[key] = number.stringValue
                    }
                }
                return Element(tag: tag, attributes: attributes)
            }
            if !elements.isEmpty { shapes[name] = elements }
        }
        return SceneIconCatalog(viewBox: viewBox, shapes: shapes)
    }
}
