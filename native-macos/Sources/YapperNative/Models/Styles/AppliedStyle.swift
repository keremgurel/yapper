import Foundation

/// Which style library template a project was given, and which of its parts
/// became which editor items.
///
/// A template is a starting arrangement, not a mode: once applied, everything
/// it set is an ordinary project value that the inspector, Chirpy and Undo
/// already handle. This only remembers what is needed to change the template's
/// own settings afterwards. Moving the seam has to move the top visual with
/// it, and the top visual has to be found again to swap what it shows.
struct AppliedStyle: Codable, Equatable, Sendable {
    /// The catalog id, for example `half-and-half`.
    var templateID: String
    /// The overlay in the template's top area, once something has been put
    /// there.
    var topOverlayID: UUID?
    /// The split's own settings, for a template with a split.
    var split: StyleSplitSettings?
}

extension EditorProject {
    /// The overlay a template put in its top area, if it is still there.
    var styleTopOverlay: ProjectOverlay? {
        guard let id = appliedStyle?.topOverlayID else { return nil }
        return overlays?.first { $0.id == id }
    }

    /// The top area of a split: everything above the camera, less the inset.
    /// `nil` when the camera has the whole frame.
    var styleTopBox: OverlayBox? {
        guard let region = cameraRegion, region.y > 0 else { return nil }
        let insetX = min(0.15, max(0, appliedStyle?.split?.visualInset ?? 0))
        let aspect = resolvedAspectRatio
        let insetY = aspect > 0 ? insetX * aspect : insetX
        return OverlayBox(
            x: insetX,
            y: insetY,
            width: max(0.1, 1 - insetX * 2),
            height: max(0.05, region.y - insetY * 2)
        )
    }
}
