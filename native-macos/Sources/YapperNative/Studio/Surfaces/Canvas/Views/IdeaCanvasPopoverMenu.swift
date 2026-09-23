import SwiftUI

/// One choice in an `IdeaCanvasPopoverMenu`.
struct IdeaCanvasMenuOption: Identifiable {
    let id: String
    let title: String
    var systemImage: String?
    var dot: Color?
    var checked = false
    var enabled = true
    var dividerBefore = false
    let action: () -> Void
}

/// A menu with a label drawn the way the page needs (a chip, an outline
/// button). SwiftUI's `Menu` flattens custom labels on the Mac, so this one
/// is a button that opens a small popover list.
struct IdeaCanvasPopoverMenu<Label: View>: View {
    let options: [IdeaCanvasMenuOption]
    var width: CGFloat = 200
    @ViewBuilder var label: () -> Label

    @State private var open = false

    var body: some View {
        Button { open.toggle() } label: { label() }
            .buttonStyle(.studioPlain)
            .popover(isPresented: $open, arrowEdge: .bottom) {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(options) { option in
                        if option.dividerBefore {
                            Rectangle().fill(Color.studioLine).frame(height: 1).padding(.vertical, 4)
                        }
                        IdeaCanvasMenuRow(option: option) {
                            open = false
                            option.action()
                        }
                    }
                }
                .padding(6)
                .frame(width: width)
            }
    }
}

private struct IdeaCanvasMenuRow: View {
    let option: IdeaCanvasMenuOption
    let select: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: select) {
            HStack(spacing: 8) {
                if let dot = option.dot {
                    Circle().fill(dot).frame(width: 6, height: 6)
                }
                if let image = option.systemImage {
                    Image(systemName: image).frame(width: 16)
                }
                Text(option.title).lineLimit(1)
                Spacer(minLength: 8)
                if option.checked { Image(systemName: "checkmark").font(.system(size: 11, weight: .semibold)) }
            }
            .font(.system(size: 13, weight: .medium))
            .padding(.horizontal, 8)
            .frame(height: 28)
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(hovering && option.enabled ? Color.studioFaintFill : .clear)
            )
        }
        .buttonStyle(.studioPlain)
        .disabled(!option.enabled)
        .opacity(option.enabled ? 1 : 0.45)
        .onHover { hovering = $0 }
    }
}
