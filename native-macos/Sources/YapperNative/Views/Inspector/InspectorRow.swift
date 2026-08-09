import SwiftUI

/// The measurements a panel of properties has to agree on.
enum InspectorMetrics {
    static let labelWidth: CGFloat = 58
}

/// One labelled line of properties. Every label starts at the same x and every
/// control at the same one after it, which is what makes a stack of unrelated
/// properties scan as a single column.
struct InspectorRow<Content: View>: View {
    let title: String
    var alignment: VerticalAlignment = .center
    let content: Content

    init(
        _ title: String,
        alignment: VerticalAlignment = .center,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.alignment = alignment
        self.content = content()
    }

    var body: some View {
        HStack(alignment: alignment, spacing: 10) {
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
                .frame(width: InspectorMetrics.labelWidth, alignment: .leading)
                .padding(.top, alignment == .top ? 3 : 0)
            content
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
        .buttonStyle(.studioPlain)
        .clickableCursor()
    }
}
