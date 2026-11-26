import Foundation

/// What a card layout adds to a span: see the matching fields on `LayoutSpan`.
struct LayoutSpanCard: Equatable, Sendable {
    var cameraTop: Double
    var cornerRadius: Double
    var popOut: Bool
    var visual: OverlayBox
    var captionY: Double?
}
