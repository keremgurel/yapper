import Foundation

/// The picture or clip in a split's top area: filling the area, cropped about
/// its middle, the way the style library's top area draws it.
enum StyleTopVisual {
    /// The part of the media that fills a box of `boxAspect` (width over
    /// height, in pixels) with nothing left over.
    static func coverCrop(mediaAspect: Double, boxAspect: Double) -> OverlayCrop {
        guard mediaAspect > 0, boxAspect > 0 else { return .full }
        if mediaAspect > boxAspect {
            let width = boxAspect / mediaAspect
            return OverlayCrop(x: (1 - width) / 2, y: 0, width: width, height: 1).clamped
        }
        let height = mediaAspect / boxAspect
        return OverlayCrop(x: 0, y: (1 - height) / 2, width: 1, height: height).clamped
    }
}

extension EditorProject {
    /// Moves the template's top visual onto the top area and crops it to
    /// fill it, after the seam or the inset changed or its media was swapped.
    /// Does nothing when the template has no top visual.
    mutating func fitStyleTopOverlay() {
        guard
            let box = styleTopBox,
            let id = appliedStyle?.topOverlayID,
            let index = overlays?.firstIndex(where: { $0.id == id })
        else { return }
        var overlay = overlays![index]
        overlay.x = box.x
        overlay.y = box.y
        overlay.width = box.width
        overlay.height = box.height
        overlay.rotation = nil
        overlay.keys = nil
        overlay.flush = true
        if let media = media.first(where: { $0.id == overlay.mediaID }) {
            let crop = StyleTopVisual.coverCrop(
                mediaAspect: CompositionBuilder.aspect(of: media),
                boxAspect: box.width * resolvedAspectRatio / box.height
            )
            overlay.crop = crop.isFull ? nil : crop
        }
        overlays![index] = overlay
        updatedAt = Date()
    }
}
