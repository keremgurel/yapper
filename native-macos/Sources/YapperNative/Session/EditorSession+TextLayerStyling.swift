import Foundation

/// Text layer content and look. The styling here takes the same patches the
/// caption inspector emits, which is what lets both tabs share one set of
/// property controls.
extension EditorSession {
    /// A finished drag on a text layer, on the canvas or along the timeline,
    /// committed through the actions Chirpy uses: position, size and angle as
    /// style fields, a move or trim on the timeline as timing.
    @discardableResult
    func commitTextLayerDraft(_ draft: ProjectTextLayer) -> Task<AppActionResult?, Never> {
        guard let stored = project.textLayers?.first(where: { $0.id == draft.id }) else { return Task { nil } }
        if draft.timelineStart != stored.timelineStart || draft.duration != stored.duration {
            let input = TextLayerUpdateInput(textLayerID: draft.id, text: nil,
                                             timelineStart: draft.timelineStart, duration: draft.duration)
            return Task { await performAppAction(input) }
        }
        var patch = TextStylePatch()
        if draft.x != stored.x { patch.x = draft.x }
        if draft.y != stored.y { patch.y = draft.y }
        if draft.width != stored.width { patch.width = draft.width }
        if draft.rotation != stored.rotation { patch.rotation = draft.rotation }
        if draft.fontScale != stored.fontScale { patch.fontScale = draft.fontScale }
        guard patch != TextStylePatch() else { return Task { nil } }
        let input = TextLayerStyleInput(textLayerIDs: [draft.id], style: TextStyleInput(patch))
        return Task { await performAppAction(input) }
    }

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
    @discardableResult
    func applyTextLayerStyle(_ patch: TextStylePatch, to id: UUID, live: Bool = false) -> Task<AppActionResult?, Never> {
        guard var layer = project.textLayers?.first(where: { $0.id == id }) else { return Task { nil } }
        guard !live else {
            layer.apply(patch)
            updateTextLayer(layer)
            return Task { nil }
        }
        return Task { await performAppAction(TextLayerStyleInput(textLayerIDs: [id], style: TextStyleInput(patch))) }
    }

    func applyTextLayerTemplate(_ template: TextTemplate, to id: UUID) {
        guard let layer = project.textLayers?.first(where: { $0.id == id }) else { return }
        let look = template.applied(to: layer.appearance)
        Task {
            let result = await performAppAction(TextLayerStyleInput(textLayerIDs: [id], style: TextStyleInput(.everything(in: look))))
            if result.status == .applied || result.status == .unchanged { setStatus("Text look: \(template.name)") }
        }
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
