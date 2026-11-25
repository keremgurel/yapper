import Foundation

/// What the Layout controls call. Each goes through the registered action, so
/// a click, a Chirpy plan and a test all take the same path. See
/// `StyleTemplateActions`.
extension EditorSession {
    func applyStyleTemplate(_ templateID: String) async {
        await performAppAction(StyleApplyInput(templateID: templateID, topMediaID: nil))
    }

    func commitStyleSplit(
        seam: Double? = nil,
        cameraZoom: Double? = nil,
        cameraFocusY: Double? = nil,
        visualInset: Double? = nil
    ) async {
        await performAppAction(StyleSplitInput(
            seam: seam,
            cameraZoom: cameraZoom,
            cameraFocusY: cameraFocusY,
            visualInset: visualInset
        ))
    }

    func replaceStyleTopVisual(with mediaID: UUID) async {
        await performAppAction(StyleTopVisualInput(mediaID: mediaID))
    }

    /// Imported pictures, clips and generated overlays that could fill the
    /// top area. The take itself is left out: it is already on screen below.
    var styleTopVisualChoices: [ProjectMedia] {
        let onMainTrack = Set(project.clips.map(\.mediaID))
        return project.media.filter { !onMainTrack.contains($0.id) }
    }
}
