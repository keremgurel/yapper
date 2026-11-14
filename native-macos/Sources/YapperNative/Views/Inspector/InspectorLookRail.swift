import SwiftUI

/// The looks, shown as what they are: a row of small previews, each drawn in
/// its own colours on the dark a caption usually sits over.
///
/// A look is a visual choice, and a dropdown of names ("Clean", "Pop",
/// "Brand") asked the creator to remember what each one looked like. The row
/// is one line tall, always on screen and scrolls sideways, so it costs the
/// panel no more height than the dropdown did.
struct InspectorLookRail: View {
    let templates: [TextTemplate]
    /// The look the text currently matches, or nil once it has been changed
    /// by hand.
    let selection: TextTemplate.ID?
    let onSelect: (TextTemplate) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 8) {
                ForEach(templates) { template in
                    InspectorLookSwatch(
                        template: template,
                        isSelected: template.id == selection
                    ) {
                        onSelect(template)
                    }
                }
            }
            // Room for the selection ring, which sits outside the tile.
            .padding(3)
        }
        .padding(-3)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Look")
    }
}

private struct InspectorLookSwatch: View {
    let template: TextTemplate
    let isSelected: Bool
    let action: () -> Void

    @State private var isHovering = false

    private static let tile = CGSize(width: 62, height: 40)

    var body: some View {
        Button(action: action) {
            VStack(spacing: 5) {
                preview
                    .frame(width: Self.tile.width, height: Self.tile.height)
                    .background(Color.previewWorkspaceBackground, in: shape)
                    .overlay {
                        shape.strokeBorder(Color.studioLine, lineWidth: 0.5)
                    }
                    .overlay {
                        if isSelected {
                            shape
                                .inset(by: -2.5)
                                .strokeBorder(Color.studioAccent, lineWidth: 1.5)
                        }
                    }
                    .opacity(isHovering || isSelected ? 1 : 0.92)
                Text(template.name)
                    .font(isSelected ? .studioCaptionStrong : .studioCaption)
                    .foregroundStyle(isSelected ? Color.primary : Color.studioTextMuted)
                    .lineLimit(1)
                    .fixedSize()
            }
            .frame(minWidth: Self.tile.width)
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .onHover { isHovering = $0 }
        .help("Use the \(template.name) look. Size and case stay as they are.")
        .accessibilityLabel(template.name)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: StudioRadius.field, style: .continuous)
    }

    private var preview: some View {
        let look = template.appearance
        let size: CGFloat = 15
        return Text("Aa")
            .font(look.font.previewFont(size: size))
            .foregroundStyle(look.color.swiftUIColor)
            .modifier(LookOutline(
                color: look.strokeEnabled ? look.strokeColor.swiftUIColor : nil,
                width: max(0.6, look.strokeWidth * size * 0.6)
            ))
            .shadow(
                color: look.shadowEnabled ? look.shadowColor.swiftUIColor : .clear,
                radius: look.shadowRadius * size * 0.5,
                y: 0.5
            )
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background {
                if look.backgroundEnabled {
                    RoundedRectangle(cornerRadius: look.cornerRadius * size, style: .continuous)
                        .fill(look.backgroundColor.swiftUIColor)
                }
            }
    }
}

/// A text outline at swatch size: the same word laid under itself in four
/// directions. Exact stroking is the renderer's job; this only has to read as
/// "outlined" in a tile 40 points tall.
private struct LookOutline: ViewModifier {
    let color: Color?
    let width: CGFloat

    func body(content: Content) -> some View {
        if let color {
            content
                .shadow(color: color, radius: 0, x: width, y: 0)
                .shadow(color: color, radius: 0, x: -width, y: 0)
                .shadow(color: color, radius: 0, x: 0, y: width)
                .shadow(color: color, radius: 0, x: 0, y: -width)
        } else {
            content
        }
    }
}
