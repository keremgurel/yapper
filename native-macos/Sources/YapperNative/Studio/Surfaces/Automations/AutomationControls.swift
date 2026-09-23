import SwiftUI

/// A destination the rule can send to: selected shows the orange edge.
struct AutomationDestinationCard: View {
    let destination: AutomationDestination
    let accountLabel: String
    let selected: Bool
    let onToggle: () -> Void

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 10, style: .continuous)
        Button(action: onToggle) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(destination.label).font(.system(size: 13, weight: .semibold))
                    Text(accountLabel).font(.system(size: 12)).foregroundStyle(.secondary)
                    Text(destination.delivery).font(.system(size: 12)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 15))
                    .foregroundStyle(selected ? Color.yapperOrange : Color.secondary.opacity(0.5))
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(shape.fill(selected ? Color.studioSelectedFill : Color.studioInputBackground))
            .overlay(shape.strokeBorder(selected ? Color.yapperOrange : Color.studioLine, lineWidth: 1))
            .contentShape(shape)
        }
        .buttonStyle(.studioPlain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// A labelled on and off switch, with an optional line under the label.
struct AutomationSwitchRow: View {
    let title: String
    var detail: String?
    var systemImage: String?
    @Binding var isOn: Bool
    var disabled = false

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .frame(width: 16)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 13, weight: .semibold))
                    if let detail {
                        Text(detail).font(.system(size: 12)).foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            Spacer(minLength: 0)
            Toggle(title, isOn: $isOn)
                .toggleStyle(.switch)
                .labelsHidden()
                .tint(Color.yapperOrange)
                .disabled(disabled)
                .clickableCursor(enabled: !disabled)
        }
    }
}

/// A quiet line of status or help text on the automations page.
struct AutomationNote: View {
    let text: String
    var danger = false
    var size: CGFloat = 12

    var body: some View {
        Text(text)
            .font(.system(size: size))
            .foregroundStyle(danger ? Color.studioDanger : Color.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}
