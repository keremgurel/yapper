import Foundation

/// A stretch of the video laid out by a style library template: the camera in
/// part of the frame, a visual in the rest, while certain words are spoken.
///
/// Anchored to the take's own seconds, like captions, so cutting a pause or a
/// retake inside it keeps the split on the same words instead of sliding it
/// onto others. Outside every span the take fills the frame as it always has.
struct LayoutSpan: Codable, Equatable, Identifiable, Sendable {
    var id: UUID = UUID()
    /// The catalog template it came from, for example `half-and-half`.
    var templateID: String
    /// The take the span sits on, and where in it, in that take's seconds.
    var mediaID: UUID
    var sourceStart: Double
    var sourceEnd: Double
    /// Where the camera is drawn while the span is on screen.
    var region: CameraRegion
    /// 1 covers the region; higher crops closer.
    var cameraZoom: Double
    /// Which line of the take stays in place as it is cropped: 0 the top,
    /// 1 the bottom.
    var cameraFocusY: Double
    /// Space kept clear around the top visual, as a fraction of the frame's
    /// width.
    var visualInset: Double = 0
    /// The overlay filling the area above the camera, once there is one.
    var topOverlayID: UUID?

    func contains(mediaID: UUID, source time: Double) -> Bool {
        self.mediaID == mediaID && time >= sourceStart && time < sourceEnd
    }

    /// The split's own settings, in the units `editor.styles.setSplit` takes.
    var settings: StyleSplitSettings {
        StyleSplitSettings(seam: region.y, cameraZoom: cameraZoom, cameraFocusY: cameraFocusY, visualInset: visualInset)
    }
}

/// What `editor.styles.setSplit` changes and its receipt reports.
struct StyleSplitSettings: Codable, Equatable, Sendable {
    var seam: Double
    var cameraZoom: Double
    var cameraFocusY: Double
    var visualInset: Double
}

extension EditorProject {
    var resolvedLayoutSpans: [LayoutSpan] { layoutSpans ?? [] }

    func layoutSpan(_ id: UUID) -> LayoutSpan? {
        resolvedLayoutSpans.first { $0.id == id }
    }

    /// The span on screen at a moment of the timeline, if any.
    func layoutSpan(atTimeline time: Double) -> LayoutSpan? {
        guard let location = sourceLocation(atTimeline: time) else { return nil }
        return resolvedLayoutSpans.first { $0.contains(mediaID: location.mediaID, source: location.source) }
    }

    /// The framing a span gives a clip of this media: covering its region,
    /// zoomed about its focus line.
    func spanFraming(_ span: LayoutSpan, for media: ProjectMedia) -> VideoFraming {
        CameraRegionFraming.framing(
            zoom: span.cameraZoom,
            focusY: span.cameraFocusY,
            sourceAspect: CompositionBuilder.aspect(of: media),
            region: span.region,
            frameAspect: resolvedAspectRatio
        )
    }
}
