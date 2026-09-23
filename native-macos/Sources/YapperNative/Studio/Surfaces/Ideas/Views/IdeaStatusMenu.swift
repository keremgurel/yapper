import SwiftUI

/// The inline status control: the status chip, opening a short list.
struct IdeaStatusMenu: View {
    let status: IdeaStatus
    let onChange: (IdeaStatus) -> Void
    @State private var open = false

    var body: some View {
        Button { open.toggle() } label: {
            HStack(spacing: 3) {
                NativeChip(text: status.label, tone: status.tone)
                Image(systemName: "chevron.down").font(.system(size: 9, weight: .medium)).foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.studioPlain)
        .accessibilityLabel("Status: \(status.label)")
        .popover(isPresented: $open, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: 2) {
                ForEach(IdeaStatus.allCases) { option in
                    Button {
                        open = false
                        if option != status { onChange(option) }
                    } label: {
                        HStack(spacing: 8) {
                            Circle().fill(option.tone.color).frame(width: 6, height: 6)
                            Text(option.label).font(.system(size: 13, weight: .medium))
                            Spacer(minLength: 12)
                            if option == status { Image(systemName: "checkmark").font(.system(size: 11, weight: .semibold)) }
                        }
                        .padding(.horizontal, 8).padding(.vertical, 6)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(IdeaMenuRowStyle())
                }
            }
            .padding(4)
            .frame(width: 168)
        }
    }
}

/// A list row in a small popover menu: plain until hovered.
struct IdeaMenuRowStyle: ButtonStyle {
    @State private var hovering = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(RoundedRectangle(cornerRadius: 6, style: .continuous).fill(hovering || configuration.isPressed ? Color.studioFaintFill : .clear))
            .onHover { hovering = $0 }
            .clickableCursor()
    }
}

/// The select box on each row and in the header.
struct IdeaCheckbox: View {
    enum Mark { case off, on, mixed }
    let mark: Mark
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(mark == .off ? Color.clear : Color.yapperOrange)
                .overlay {
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .strokeBorder(mark == .off ? Color.studioLineStrong : Color.yapperOrange, lineWidth: 1)
                }
                .overlay {
                    if mark != .off {
                        Image(systemName: mark == .on ? "checkmark" : "minus")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: 16, height: 16)
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .accessibilityLabel(mark == .on ? "Deselect" : "Select")
    }
}
