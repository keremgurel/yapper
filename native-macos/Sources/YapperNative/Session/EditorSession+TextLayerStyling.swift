import Foundation

/// Text layer content and look. The styling here takes the same patches the
/// caption inspector emits, which is what lets both tabs share one set of
/// property controls.
extension EditorSession {
    func setTextLayerText(_ text: String, for id: UUID) {
        guard var layer = project.textLayers?.first(where: { $0.id == id }), layer.text != text else {
            return
        }
        layer.text = text
        updateTextLayer(layer)
    }

    /// Layer edits always coalesce — the canvas draws them directly and the
    /// commit lands once the gesture goes quiet — so `live` is accepted for
    /// symmetry with captions and needs nothing extra here.
    func applyTextLayerStyle(_ patch: TextStylePatch, to id: UUID, live: Bool = false) {
        guard var layer = project.textLayers?.first(where: { $0.id == id }) else { return }
        layer.apply(patch)
        updateTextLayer(layer)
    }

    func applyTextLayerTemplate(_ template: TextTemplate, to id: UUID) {
        guard var layer = project.textLayers?.first(where: { $0.id == id }) else { return }
        layer.appearance = template.applied(to: layer.appearance)
        updateTextLayer(layer)
        setStatus("Text look: \(template.name)")
    }
}

extension ProjectTextLayer {
    /// A text layer holds the same fields a caption style does — a position, a
    /// width, an appearance — so a patch is folded in through one rather than
    /// repeating every clamping rule here.
    mutating func apply(_ patch: TextStylePatch) {
        var style = TextStyle(
            x: x,
            y: y,
            width: width,
            rotation: rotation,
            appearance: appearance
        )
        style.apply(patch)
        x = style.x
        y = style.y
        width = style.width
        rotation = style.rotation
        appearance = style.appearance
    }
}
