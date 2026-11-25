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
    /// The overlay filling a span's top area, if it is still there.
    func topOverlay(of span: LayoutSpan) -> ProjectOverlay? {
        guard let id = span.topOverlayID else { return nil }
        return overlays?.first { $0.id == id }
    }

    /// Moves a span's top visual onto its top area for exactly as long as the
    /// span is on screen, cropped to fill, after the seam, the inset, the
    /// span's words or the media changed. Does nothing without a top visual.
    mutating func fitTopOverlay(of spanID: UUID) {
        guard
            let span = layoutSpan(spanID),
            let box = topBox(of: span),
            let extent = timelineExtent(of: span),
            let id = span.topOverlayID,
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
        overlay.timelineStart = extent.lowerBound
        let length = extent.upperBound - extent.lowerBound
        if let media = media.first(where: { $0.id == overlay.mediaID }) {
            overlay.duration = media.isImage ? length : min(length, max(0.1, media.duration - overlay.sourceStart))
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
