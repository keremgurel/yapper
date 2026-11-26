import Foundation

/// Placing, changing and removing layout spans. Each keeps the parts that
/// belong to it (its top visual, the captions under its seam) in step.
extension EditorProject {
    /// Captions sit this far under a split's seam, as a fraction of the frame
    /// height: the gallery's 48 px on a 1920 px frame, just on the camera half
    /// so a white screenshot above cannot swallow them.
    static let captionGapUnderSeam = 0.025

    /// Lays a split over part of one take, cutting back any span it overlaps.
    /// Returns the new span.
    @discardableResult
    mutating func placeLayoutSpan(
        templateID: String,
        camera: CameraRegion,
        zoom: Double,
        focusY: Double,
        inset: Double,
        mediaID: UUID,
        source: ClosedRange<Double>,
        card: LayoutSpanCard? = nil
    ) -> LayoutSpan {
        clearLayout(mediaID: mediaID, source: source)
        var span = LayoutSpan(
            templateID: templateID, mediaID: mediaID,
            sourceStart: source.lowerBound, sourceEnd: source.upperBound,
            region: camera, cameraZoom: zoom, cameraFocusY: focusY, visualInset: inset
        )
        if let card {
            span.cameraTop = card.cameraTop
            span.cornerRadius = card.cornerRadius
            span.popOut = card.popOut
            span.visualBox = card.visual
            span.captionY = card.captionY
        }
        layoutSpans = (layoutSpans ?? []) + [span]
        setSpanCaptionHeight(span)
        updatedAt = Date()
        return span
    }

    /// Gives part of one take the whole frame back: spans inside it go, spans
    /// that reach into it are cut back to the side that is left. A span cut in
    /// two keeps the longer side.
    mutating func clearLayout(mediaID: UUID, source: ClosedRange<Double>) {
        var kept: [LayoutSpan] = []
        for span in resolvedLayoutSpans {
            guard span.mediaID == mediaID, span.sourceEnd > source.lowerBound, span.sourceStart < source.upperBound else {
                kept.append(span)
                continue
            }
            clearSpanCaptionHeight(span)
            let before = source.lowerBound - span.sourceStart
            let after = span.sourceEnd - source.upperBound
            guard max(before, after) > 0.2 else {
                if let overlay = span.topOverlayID { overlays?.removeAll { $0.id == overlay } }
                continue
            }
            var trimmed = span
            if before >= after { trimmed.sourceEnd = source.lowerBound } else { trimmed.sourceStart = source.upperBound }
            kept.append(trimmed)
        }
        layoutSpans = kept.isEmpty ? nil : kept
        for span in kept where span.mediaID == mediaID {
            setSpanCaptionHeight(span)
            fitTopOverlay(of: span.id)
        }
    }

    /// Changes one span's own settings and moves what follows the seam.
    mutating func setSplit(_ id: UUID, _ input: StyleSplitInput) {
        guard let index = layoutSpans?.firstIndex(where: { $0.id == id }) else { return }
        var span = layoutSpans![index]
        if let seam = input.seam {
            let moved = seam - span.region.y
            span.region = CameraRegion(x: span.region.x, y: seam, width: span.region.width, height: max(0.15, 1 - seam))
            span.captionY = span.captionY.map { $0 + moved }
        }
        if let zoom = input.cameraZoom { span.cameraZoom = zoom }
        if let focus = input.cameraFocusY { span.cameraFocusY = focus }
        if let inset = input.visualInset { span.visualInset = min(0.15, max(0, inset)) }
        layoutSpans![index] = span
        setSpanCaptionHeight(span)
        fitTopOverlay(of: id)
        updatedAt = Date()
    }

    /// The area above a span's camera, less its inset.
    func topBox(of span: LayoutSpan) -> OverlayBox? {
        if let visual = span.visualBox { return visual }
        guard span.region.y > 0.05 else { return nil }
        let insetX = span.visualInset
        let insetY = insetX * resolvedAspectRatio
        return OverlayBox(x: insetX, y: insetY, width: max(0.1, 1 - insetX * 2), height: max(0.05, span.region.y - insetY * 2))
    }

    /// Captions spoken inside the span sit under its seam. Done as each
    /// caption's own height, so the inspector shows it and a caption moved by
    /// hand can be moved again.
    private mutating func setSpanCaptionHeight(_ span: LayoutSpan) {
        let y = min(0.95, span.captionY ?? (span.region.y + Self.captionGapUnderSeam))
        editCaptions(in: span) { $0.override(with: TextStylePatch(y: y)) }
    }

    private mutating func clearSpanCaptionHeight(_ span: LayoutSpan) {
        editCaptions(in: span) { $0.clearOverrides(in: TextStylePatch(y: 0)) }
    }

    private mutating func editCaptions(in span: LayoutSpan, _ change: (inout ProjectCaption) -> Void) {
        guard captions != nil else { return }
        for index in captions!.indices {
            let caption = captions![index]
            let middle = (caption.sourceStart + caption.sourceEnd) / 2
            guard !caption.locked, span.contains(mediaID: caption.mediaID, source: middle) else { continue }
            change(&captions![index])
        }
    }
}
