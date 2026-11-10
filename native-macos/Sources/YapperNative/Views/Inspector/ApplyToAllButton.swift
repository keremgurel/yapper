import SwiftUI

/// The action that copies one group of settings onto every clip on the main
/// track.
///
/// One of these per section, in the section's header, rather than one per
/// row. A row-level "Match 15 clips" repeated down the panel read as fifteen
/// different things to press, and it never said which settings it carried.
/// In the header it sits above exactly the settings it copies.
///
/// The count is on the face of the button rather than only in the tooltip. How
/// far an action reaches is the thing worth knowing before pressing it.
struct ApplyToAllButton: View {
    /// What is being copied, in the words of the section it sits in.
    let what: String
    /// How many others it would land on. Nothing is shown when there are none.
    let count: Int
    var noun = "clip"
    let action: () -> Void

    var body: some View {
        if count > 0 {
            Button(action: action) {
                Label("Apply to all \(count + 1) \(noun)s", systemImage: "square.on.square")
            }
            .buttonStyle(InspectorHeaderButtonStyle())
            .help("Give every \(noun) on this track this \(what)")
        }
    }
}

/// The quiet text button a section header carries.
struct InspectorHeaderButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    @State private var hovering = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .labelStyle(.titleAndIcon)
            .font(.studioCaption)
            .lineLimit(1)
            .fixedSize()
            .foregroundStyle(hovering || configuration.isPressed ? Color.primary : Color.secondary)
            .padding(.horizontal, 6)
            .frame(height: 22)
            .background {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .fill(Color.studioFaintFill.opacity(hovering || configuration.isPressed ? 1 : 0))
            }
            .contentShape(Rectangle())
            .onHover { hovering = $0 }
            .opacity(isEnabled ? 1 : 0.5)
            .clickableCursor(enabled: isEnabled)
    }
}
