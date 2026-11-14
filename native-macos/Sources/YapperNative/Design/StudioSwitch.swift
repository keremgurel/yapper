import SwiftUI

/// A small switch in the action colour rather than the system accent, so every
/// switch in the app reads as one piece: ink when on, a stone well when off.
struct StudioSwitch: View {
    @Binding var isOn: Bool

    var body: some View {
        Button {
            isOn.toggle()
        } label: {
            Capsule(style: .continuous)
                .fill(isOn ? Color.studioAccent : Color.studioTray)
                .overlay {
                    Capsule(style: .continuous)
                        .strokeBorder(isOn ? Color.clear : Color.studioLine, lineWidth: 1)
                }
                .overlay(alignment: isOn ? .trailing : .leading) {
                    Circle()
                        .fill(isOn ? Color.studioAccentForeground : Color.white)
                        .padding(1.5)
                        .shadow(color: .black.opacity(0.25), radius: 1, y: 0.5)
                }
                .frame(width: 28, height: 16)
                .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .animation(.easeOut(duration: 0.12), value: isOn)
        .accessibilityAddTraits(.isToggle)
        .accessibilityValue(isOn ? "On" : "Off")
    }
}
