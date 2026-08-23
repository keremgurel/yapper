import SwiftUI

/// The player, carrying whatever framing the composition has not caught up to.
///
/// The composition is what really frames the main track, and rebuilding it
/// takes long enough that doing it per mouse event would stutter. So the
/// picture on screen is pushed the rest of the way here, as a render-time
/// transform: the difference between the framing the composition was built with
/// and the framing that is wanted, whether that is a gesture in flight or one
/// that has already been committed and is waiting on the rebuild. Once the
/// rebuild lands the two agree and this goes back to doing nothing.
///
/// The wait matters as much as the gesture. Letting go used to clear the
/// transform at once, which put the picture back where it started for a fifth
/// of a second of debounce plus however long the build took, and only then
/// jumped it to the new framing. Now nothing moves backwards.
///
/// A cutaway is drawn by the same composition, so pushing the picture here
/// would push the cutaway with it. `EditorSession.hasCompositedOverlayOnScreen`
/// is where that is headed off: while one is on screen there is no transform at
/// all, and the picture follows the drag at the rebuild's pace instead.
struct FramedPlayerView: View {
    @ObservedObject var session: EditorSession
    /// Both of these move the transform: the drag while a gesture runs, the
    /// store when the rebuilt composition arrives.
    @ObservedObject var drag: CanvasDragState
    @ObservedObject var renderedFraming: RenderedFramingStore
    let stageSize: CGSize

    var body: some View {
        let preview = session.framingPreview(in: stageSize)
        // Turn, then zoom, then slide: the order the composition itself frames
        // in, and the reason the difference between the two can be expressed as
        // one transform at all.
        NativePlayerView(player: session.player)
            .id(ObjectIdentifier(session.player))
            .rotationEffect(.degrees(preview?.rotation ?? 0))
            .scaleEffect(preview?.scale ?? 1)
            .offset(preview?.offset ?? .zero)
    }
}
