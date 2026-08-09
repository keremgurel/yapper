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
/// One honest caveat: a video cutaway is drawn by the same composition, so a
/// cutaway that happens to be on screen travels with the picture until the
/// rebuild lands. Framing the speaker while a cutaway covers them is not a
/// thing anyone does on purpose.
struct FramedPlayerView: View {
    @ObservedObject var session: EditorSession
    /// Both of these move the transform: the drag while a gesture runs, the
    /// store when the rebuilt composition arrives.
    @ObservedObject var drag: CanvasDragState
    @ObservedObject var renderedFraming: RenderedFramingStore
    let stageSize: CGSize

    var body: some View {
        let preview = session.framingPreviewTransform
        NativePlayerView(player: session.player)
            .id(ObjectIdentifier(session.player))
            .scaleEffect(preview?.scale ?? 1)
            .offset(
                x: stageSize.width * (preview?.x ?? 0),
                y: stageSize.height * (preview?.y ?? 0)
            )
    }
}
