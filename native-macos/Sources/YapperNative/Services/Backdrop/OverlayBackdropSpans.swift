import CoreImage
import Foundation

/// A stretch of the timeline with something drawn behind a card.
struct OverlayBackdropSpan: @unchecked Sendable {
    enum Fill: @unchecked Sendable {
        /// The speaker's own picture, frosted by the compositor frame by frame.
        case frosted
        /// A preset, painted once at the render size.
        case still(CIImage)
    }

    let start: Double
    let end: Double
    let lane: Int
    let fill: Fill

    var fade: LayerFade {
        LayerFade(start: start, duration: min(OverlayBackdrop.fadeIn, (end - start) / 2))
    }

    /// Where the composition has to cut an instruction for this span: in, out,
    /// and the moment the fade finishes, after which nothing changes.
    var boundaries: [Double] { [start, start + fade.duration, end] }
}

/// Which backdrops a project draws, and which one is showing at a time.
enum OverlayBackdropSpans {
    static func make(
        _ overlays: [ProjectOverlay],
        isMainTrackHidden: Bool,
        renderSize: CGSize
    ) -> [OverlayBackdropSpan] {
        overlays.compactMap { overlay in
            guard overlay.isVisible, overlay.duration > 0, let backdrop = overlay.backdrop, backdrop.isDrawable else {
                return nil
            }
            let fill: OverlayBackdropSpan.Fill
            switch backdrop.kind {
            case .frosted:
                // Nothing to frost when the speaker is hidden.
                guard !isMainTrackHidden else { return nil }
                fill = .frosted
            case .preset:
                guard
                    let preset = backdrop.preset,
                    let image = BackdropPresetRenderer.image(
                        preset,
                        width: Int(renderSize.width),
                        height: Int(renderSize.height),
                        focus: (overlay.x + overlay.width / 2, overlay.y + overlay.height / 2)
                    )
                else { return nil }
                fill = .still(CIImage(cgImage: image))
            }
            return OverlayBackdropSpan(
                start: overlay.timelineStart,
                end: overlay.timelineStart + overlay.duration,
                lane: overlay.lane,
                fill: fill
            )
        }
    }

    /// The backdrop showing across `start` to `end`, if any. When two cards
    /// with backdrops overlap, the one on the higher lane is in front, so its
    /// backdrop is the one seen.
    static func active(in spans: [OverlayBackdropSpan], from start: Double, to end: Double) -> OverlayBackdropSpan? {
        let midpoint = (start + end) / 2
        return spans
            .filter { $0.start <= midpoint && midpoint < $0.end }
            .max { $0.lane < $1.lane }
    }
}
