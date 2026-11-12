import SwiftUI

/// One collapsible group of properties, the way a design tool lays them out: a
/// quiet header you can fold away, an optional switch that turns the whole
/// effect on and off, and a reset that only appears once there is something to
/// reset.
///
/// Folding state is remembered between launches, so the sections a creator keeps
/// open stay open.
struct InspectorSection<Content: View>: View {
    let title: String
    /// Turns the effect this section describes on and off. `nil` for sections
    /// that are always on, like Text.
    var isEnabled: Binding<Bool>?
    /// Shows the reset control. Left false for sections with nothing to undo.
    var isModified = false
    var onReset: (() -> Void)?
    /// The section's one way to copy its settings to other items, drawn in
    /// the header: `ApplyToAllButton` or `OverlayApplyMenu`. Once per
    /// section, never once per row.
    var accessory: AnyView?
    @ViewBuilder let content: Content

    @AppStorage private var isExpanded: Bool
    @State private var isHovering = false

    init(
        _ title: String,
        id: String,
        expandedByDefault: Bool = true,
        isEnabled: Binding<Bool>? = nil,
        isModified: Bool = false,
        onReset: (() -> Void)? = nil,
        accessory: AnyView? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.isEnabled = isEnabled
        self.isModified = isModified
        self.onReset = onReset
        self.accessory = accessory
        self.content = content()
        _isExpanded = AppStorage(wrappedValue: expandedByDefault, "inspector.section.\(id)")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    content
                }
                .padding(.bottom, 12)
                // A disabled effect stays readable rather than vanishing: the
                // creator can see what turning it back on would give them.
                .disabled(isEnabled?.wrappedValue == false)
                .opacity(isEnabled?.wrappedValue == false ? 0.4 : 1)
            }
        }
        .onHover { isHovering = $0 }
    }

    private var header: some View {
        HStack(spacing: 6) {
            Button {
                withAnimation(.easeOut(duration: 0.12)) { isExpanded.toggle() }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color.studioTextMuted)
                        .frame(width: 10)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    Text(title)
                        .font(.studioLabelStrong)
                        .foregroundStyle(.primary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
        .clickableCursor()

            Spacer(minLength: 4)

            if isModified, let onReset {
                Button(action: onReset) {
                    Image(systemName: "arrow.uturn.backward")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.secondary)
                        .frame(width: 18, height: 18)
                }
                .buttonStyle(.studioPlain)
        .clickableCursor()
                .opacity(isHovering ? 1 : 0)
                .help("Reset \(title.lowercased())")
            }

            if isExpanded, let accessory {
                accessory
            }

            if let isEnabled {
                StudioSwitch(isOn: isEnabled)
            }
        }
        .frame(height: 32)
    }
}
