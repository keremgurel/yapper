import SwiftUI

/// A caption card's words at the size they take on the stage.
///
/// The card draws it; the selection chrome draws it hidden, purely to be the
/// same size, so the outline and the grips sit on the card.
struct CaptionCanvasLabel: View {
    let cue: ProjectCaptionCue
    let canvasSize: CGSize
    /// A width being dragged right now, which wins over the saved one.
    var width: Double?
    /// Text being typed into the card's row, which wins over the saved text
    /// until it is saved.
    var typed: String?

    var body: some View {
        let style = cue.style
        AppearanceText(
            text: typed ?? cue.text,
            appearance: style.appearance,
            fontSize: max(9, canvasSize.height * style.fontScale)
        )
        .frame(maxWidth: max(40, canvasSize.width * (width ?? style.width)))
    }
}
