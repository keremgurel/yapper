import SwiftUI

/// The format a new idea starts in, in the composer's footer. Shows the
/// default until changed, and says where the default lives.
struct ComposerFormatMenu: View {
    @ObservedObject var format: CaptureFormat = .shared

    var body: some View {
        Menu {
            ForEach(IdeaCanvasVersionFormat.allCases) { option in
                Button {
                    format.chosen = option == format.defaultFormat ? nil : option
                } label: {
                    if option == format.current {
                        Label(menuTitle(option), systemImage: "checkmark")
                    } else {
                        Text(menuTitle(option))
                    }
                }
            }
            Divider()
            Text("Change your default in Brain")
        } label: {
            HStack(spacing: 6) {
                Circle().fill(format.current.tone.color).frame(width: 6, height: 6)
                Text(format.current.label).font(.system(size: 12, weight: .medium))
                Image(systemName: "chevron.down").font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10)
            .frame(height: 26)
            .background(Capsule().fill(Color.studioFaintFill))
        }
        .menuStyle(.button)
        .buttonStyle(.studioPlain)
        .menuIndicator(.hidden)
        .fixedSize()
        .clickableCursor()
        .help("The format this idea starts in")
        .task { await format.refresh() }
    }

    private func menuTitle(_ option: IdeaCanvasVersionFormat) -> String {
        option == format.defaultFormat ? "\(option.label) (default)" : option.label
    }
}
