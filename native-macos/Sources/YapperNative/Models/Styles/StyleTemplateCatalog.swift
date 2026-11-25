import Foundation

/// The style library templates the editor can apply, as compiled from the web
/// app's style library (`src/lib/style-library/native/`). The React entries
/// there stay the design source; this file is what they come out as in the
/// editor's own terms, and a test on the web side fails when it is stale.
struct StyleTemplateCatalog: Decodable, Sendable {
    let version: Int
    let templates: [StyleTemplatePlan]

    func template(_ id: String) -> StyleTemplatePlan? {
        templates.first { $0.id == id }
    }

    /// The bundled catalog, or an empty one when the app was built without it.
    static let bundled: StyleTemplateCatalog = {
        guard
            let url = AppResources.url(forResource: "templates", withExtension: "json", subdirectory: "StyleTemplates"),
            let data = try? Data(contentsOf: url),
            let catalog = try? JSONDecoder().decode(StyleTemplateCatalog.self, from: data)
        else { return StyleTemplateCatalog(version: 1, templates: []) }
        return catalog
    }()
}

struct StyleTemplatePlan: Decodable, Equatable, Sendable {
    let id: String
    let name: String
    let summary: String
    let layout: StyleLayoutPlan
    /// Applied through the same rules as `editor.project.setBackdrop`.
    let backdrop: ProjectBackdropInput?
    let captions: StyleCaptionPlan?
    let unsupported: [String]
}

struct StyleCaptionPlan: Decodable, Equatable, Sendable {
    /// The same shape `editor.captions.setStyle` takes.
    let style: TextStyleInput
    let wordsPerCard: Int
}

struct StyleBoxPlan: Decodable, Equatable, Sendable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

enum StyleLayoutPlan: Decodable, Equatable, Sendable {
    case fullFrame
    case split(camera: StyleBoxPlan, cameraZoom: Double, cameraFocusY: Double, top: StyleBoxPlan)
    /// The take in a rounded card at the bottom, placed by its headroom, with
    /// an optional pop-out, and a box above for a visual shown whole.
    case card(camera: StyleBoxPlan, cameraTop: Double, cornerRadius: Double, popOut: Bool, visual: StyleBoxPlan)

    private enum CodingKeys: String, CodingKey {
        case kind, camera, cameraZoom, cameraFocusY, top, cameraTop, cornerRadius, popOut, visual
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .kind) {
        case "fullFrame":
            self = .fullFrame
        case "split":
            self = .split(
                camera: try container.decode(StyleBoxPlan.self, forKey: .camera),
                cameraZoom: try container.decode(Double.self, forKey: .cameraZoom),
                cameraFocusY: try container.decode(Double.self, forKey: .cameraFocusY),
                top: try container.decode(StyleBoxPlan.self, forKey: .top)
            )
        case "card":
            self = .card(
                camera: try container.decode(StyleBoxPlan.self, forKey: .camera),
                cameraTop: try container.decode(Double.self, forKey: .cameraTop),
                cornerRadius: try container.decode(Double.self, forKey: .cornerRadius),
                popOut: try container.decode(Bool.self, forKey: .popOut),
                visual: try container.decode(StyleBoxPlan.self, forKey: .visual)
            )
        case let other:
            throw DecodingError.dataCorruptedError(
                forKey: .kind, in: container, debugDescription: "Unknown layout '\(other)'."
            )
        }
    }
}
