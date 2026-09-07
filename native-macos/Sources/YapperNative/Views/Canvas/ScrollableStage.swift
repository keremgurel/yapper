import SwiftUI

/// Puts the preview stage on a scroller, so a stage larger than the panel can
/// be moved around rather than cropped to whatever happens to be in the middle.
///
/// Applied whatever the zoom, and switched off rather than removed below the
/// fit. Wrapping and unwrapping the stage as it crosses 100% would change the
/// view's identity, and the thing inside it is an `AVPlayerLayer`: SwiftUI
/// would tear the player down and build a new one, which on a paused frame
/// reads as the picture flickering every time the zoom passes a round number.
///
/// The minimum frame is what keeps a stage smaller than the panel centred
/// instead of parked in the top left, which is where a scroller puts undersized
/// content by default.
struct ScrollableStage: ViewModifier {
    let size: CGSize
    let enabled: Bool

    func body(content: Content) -> some View {
        ScrollView([.horizontal, .vertical]) {
            content
                .frame(
                    minWidth: max(1, size.width),
                    minHeight: max(1, size.height)
                )
        }
        .scrollDisabled(!enabled)
        .scrollIndicators(enabled ? .automatic : .never)
    }
}
