import Foundation

extension EditorProject {
    /// Lays a template over each stretch: its look on the whole project, its
    /// layout only where it was asked for. A full-frame template gives those
    /// stretches the whole frame back. Returns the spans it placed.
    mutating func applyStyleTemplate(_ plan: StyleTemplatePlan, over ranges: [StyleRange]) -> [LayoutSpan] {
        let wholeVideo = ranges == StyleRange.wholeVideo(self)
        if let backdrop = plan.backdrop { applyStyleBackdrop(backdrop) }
        if let captions = plan.captions {
            // Validated by the caller before anything changed.
            try? applyStyleCaptions(captions, includingHeight: wholeVideo && plan.layout == .fullFrame)
        }
        switch plan.layout {
        case .fullFrame:
            for range in ranges { clearLayout(mediaID: range.mediaID, source: range.source) }
            return []
        case let .card(camera, cameraTop, cornerRadius, popOut, visual):
            let card = LayoutSpanCard(
                cameraTop: cameraTop, cornerRadius: cornerRadius, popOut: popOut,
                visual: OverlayBox(x: visual.x, y: visual.y, width: visual.width, height: visual.height),
                captionY: plan.captions?.style.y
            )
            return ranges.map { range in
                placeLayoutSpan(
                    templateID: plan.id,
                    camera: CameraRegion(x: camera.x, y: camera.y, width: camera.width, height: camera.height),
                    zoom: 1, focusY: 0.5, inset: 0,
                    mediaID: range.mediaID, source: range.source, card: card
                )
            }
        case let .split(camera, zoom, focusY, top):
            return ranges.map { range in
                placeLayoutSpan(
                    templateID: plan.id,
                    camera: CameraRegion(x: camera.x, y: camera.y, width: camera.width, height: camera.height),
                    zoom: zoom, focusY: focusY, inset: max(0, top.x),
                    mediaID: range.mediaID, source: range.source
                )
            }
        }
    }

    /// From the first moment any of these stretches is on screen to the last.
    func timelineExtent(of ranges: [StyleRange]) -> ClosedRange<Double> {
        let spans = ranges.map {
            LayoutSpan(templateID: "", mediaID: $0.mediaID, sourceStart: $0.source.lowerBound, sourceEnd: $0.source.upperBound,
                       region: .below(seam: 0.5), cameraZoom: 1, cameraFocusY: 0.5)
        }
        let extents = spans.compactMap(timelineExtent(of:))
        guard let first = extents.map(\.lowerBound).min(), let last = extents.map(\.upperBound).max() else { return 0 ... 0 }
        return first ... last
    }
}
