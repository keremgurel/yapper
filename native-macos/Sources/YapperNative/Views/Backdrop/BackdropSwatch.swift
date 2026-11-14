import SwiftUI

/// One backdrop choice drawn as a small portrait of what it looks like, with
/// the selected one ringed. Shared by the overlay's Backdrop row and the
/// Video tab's background, so both pick from the same pictures.
struct BackdropSwatch<Picture: View>: View {
    let name: String
    let selected: Bool
    let action: () -> Void
    @ViewBuilder var picture: () -> Picture

    var body: some View {
        Button(action: action) {
            picture()
                .frame(width: 34, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .strokeBorder(Color.studioLine, lineWidth: 1)
                }
                .padding(2)
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(selected ? Color.studioAccent : Color.clear, lineWidth: 2)
                }
        }
        .buttonStyle(.studioPlain)
        .help(name)
        .accessibilityLabel("Backdrop: \(name)")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// A preset, painted small.
struct BackdropPresetPicture: View {
    let preset: BackdropPreset
    var colors: [String]?

    var body: some View {
        if let image = BackdropPresetRenderer.image(preset, width: 68, height: 96, colors: colors) {
            Image(decorative: image, scale: 2).resizable()
        } else {
            Color.black
        }
    }
}

/// Swatches wrap onto a second line rather than run off a narrow pane.
enum BackdropSwatchGrid {
    static let columns = [GridItem(.adaptive(minimum: 38, maximum: 38), spacing: 6, alignment: .leading)]
}
