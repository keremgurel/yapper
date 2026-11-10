import SwiftUI

/// The measurements a panel of properties has to agree on.
private struct InspectorLabelKey: EnvironmentKey { static let defaultValue = "Value" }
extension EnvironmentValues {
    var inspectorControlLabel: String {
        get { self[InspectorLabelKey.self] }
        set { self[InspectorLabelKey.self] = newValue }
    }
}
enum InspectorMetrics {
    /// Wide enough for the longest label in the app ("Clear blemishes") on
    /// one line. A label that wraps or a control that starts at a different x
    /// on every row is what made the panels read as a jumble.
    static let labelWidth: CGFloat = 92
    /// Between the controls inside one row.
    static let controlSpacing: CGFloat = 8
}

/// One labelled line of properties. Every label starts at the same x and every
/// control at the same one after it, which is what makes a stack of unrelated
/// properties scan as a single column.
///
/// `detail` is the quiet line that says what the setting does or what it is
/// set to. It goes under the controls, never beside them: grey words sitting
/// next to a button read as another, weaker button.
struct InspectorRow<Content: View>: View {
    let title: String
    var alignment: VerticalAlignment = .center
    var detail: String?
    let content: Content

    init(
        _ title: String,
        alignment: VerticalAlignment = .center,
        detail: String? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.alignment = detail == nil ? alignment : .top
        self.detail = detail
        self.content = content()
    }

    var body: some View {
        HStack(alignment: alignment, spacing: 10) {
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .frame(width: InspectorMetrics.labelWidth, alignment: .leading)
                .frame(minHeight: 24)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: InspectorMetrics.controlSpacing) {
                    content.environment(\.inspectorControlLabel, title)
                }
                .frame(minHeight: 24)
                if let detail {
                    Text(detail)
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

/// A row of mutually exclusive choices drawn as one sunken track with the
/// selection raised out of it, rather than a row of loose buttons.
struct InspectorSegmentedControl<Value: Hashable>: View {
    struct Option: Identifiable {
        var value: Value
        var label: String
        var systemImage: String?
        var font: Font?

        init(value: Value, label: String, systemImage: String? = nil, font: Font? = nil) {
            self.value = value
            self.label = label
            self.systemImage = systemImage
            self.font = font
        }

        var id: Value { value }
    }

    let options: [Option]
    let selection: Value
    let onSelect: (Value) -> Void

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options) { option in
                segment(option)
            }
        }
        .padding(2)
        .background(Color.studioInputBackground)
        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
        // As wide as its choices need, not the whole row: a two-way switch
        // stretched across a wide pane looked like a progress bar.
        .frame(maxWidth: CGFloat(options.count) * 96, alignment: .leading)
    }

    private func segment(_ option: Option) -> some View {
        let isSelected = option.value == selection
        return Button {
            onSelect(option.value)
        } label: {
            HStack(spacing: 4) {
                if let systemImage = option.systemImage {
                    Image(systemName: systemImage).font(.system(size: 9, weight: .bold))
                }
                if !option.label.isEmpty {
                    Text(option.label)
                        .font(option.font ?? .system(size: 11, weight: .semibold))
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.85)
            .frame(maxWidth: .infinity)
            .frame(height: 21)
            .foregroundStyle(isSelected ? Color.primary : Color.primary.opacity(0.62))
            // A raised chip rather than a coloured one.
            //
            // Orange is the app's way of saying "this is the thing you press",
            // and a panel where the font, the casing, the word count and the
            // scope were all orange said it about everything at once, which is
            // the same as saying nothing. A selection inside a control only has
            // to look picked out from its neighbours, and being lifted off the
            // track does that.
            .background {
                if isSelected {
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .fill(Color.studioRaisedChip)
                        .overlay {
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .strokeBorder(Color.studioLine.opacity(0.9), lineWidth: 0.7)
                        }
                        .shadow(color: .black.opacity(0.16), radius: 1.5, y: 0.5)
                }
            }
            .contentShape(Rectangle())
        }
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .buttonStyle(.studioPlain)
        .clickableCursor()
    }
}
