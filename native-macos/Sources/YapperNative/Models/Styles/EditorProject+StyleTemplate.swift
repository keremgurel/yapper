import Foundation

/// The split's own settings, in the units `editor.styles.setSplit` takes.
struct StyleSplitSettings: Codable, Equatable, Sendable {
    var seam: Double
    var cameraZoom: Double
    var cameraFocusY: Double
    var visualInset: Double
}

extension EditorProject {
    /// Applies a template's layout: the camera region and the clips' framing,
    /// and the record of which template this is. Returns the clips whose
    /// framing was left alone.
    mutating func applyStyleLayout(_ plan: StyleTemplatePlan) -> [UUID] {
        let topOverlayID = appliedStyle?.topOverlayID
        switch plan.layout {
        case .fullFrame:
            // The top visual belongs to the split; on a full frame it would
            // sit on the speaker's face.
            if let topOverlayID { overlays?.removeAll { $0.id == topOverlayID } }
            appliedStyle = AppliedStyle(templateID: plan.id)
            return setCameraLayout(nil)
        case let .split(camera, zoom, focusY, top):
            let inset = max(0, top.x)
            appliedStyle = AppliedStyle(
                templateID: plan.id,
                topOverlayID: topOverlayID,
                split: StyleSplitSettings(seam: camera.y, cameraZoom: zoom, cameraFocusY: focusY, visualInset: inset)
            )
            let skipped = setCameraLayout(
                CameraRegion(x: camera.x, y: camera.y, width: camera.width, height: camera.height),
                zoom: zoom,
                focusY: focusY
            )
            fitStyleTopOverlay()
            return skipped
        }
    }

    /// Changes the split's own settings. The camera, the top visual and the
    /// captions move with the seam; captions someone placed by hand stay.
    mutating func setStyleSplit(_ input: StyleSplitInput) -> [UUID] {
        guard var settings = appliedStyle?.split, let region = cameraRegion else { return [] }
        let oldSeam = region.y
        if let seam = input.seam { settings.seam = seam }
        if let zoom = input.cameraZoom { settings.cameraZoom = zoom }
        if let focus = input.cameraFocusY { settings.cameraFocusY = focus }
        if let inset = input.visualInset { settings.visualInset = inset }
        appliedStyle?.split = settings
        let skipped = setCameraLayout(
            .below(seam: settings.seam),
            zoom: settings.cameraZoom,
            focusY: settings.cameraFocusY
        )
        fitStyleTopOverlay()
        if let moved = cameraRegion?.y, moved != oldSeam, var style = captionStyle {
            // Only the shared caption height, and only by the distance the seam
            // moved, so captions that sat under the seam still do.
            style.y = min(0.95, max(0.05, style.y + moved - oldSeam))
            captionStyle = style
        }
        return skipped
    }

    /// What `editor.styles.setSplit` reads back, for receipts and the
    /// inspector. `nil` without a split.
    var styleSplitSettings: StyleSplitSettings? {
        guard var settings = appliedStyle?.split, let region = cameraRegion else { return nil }
        settings.seam = region.y
        return settings
    }
}
