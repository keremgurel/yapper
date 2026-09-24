import SwiftUI

/// The idea's versions as tabs under the title bar: each format with its
/// colour, the lead marked, and a quiet dashed plus on a format that has no
/// version yet. The whole page below switches with the selection.
struct IdeaCanvasFormatTabs: View {
    let lead: IdeaCanvasVersionFormat
    /// Formats with a version, the lead included.
    let existing: Set<IdeaCanvasVersionFormat>
    let writing: IdeaCanvasVersionFormat?
    @Binding var selection: IdeaCanvasVersionFormat
    /// Asks to delete a written version. The lead can't be deleted.
    var onDelete: (IdeaCanvasVersionFormat) -> Void = { _ in }

    var body: some View {
        HStack(alignment: .bottom, spacing: 24) {
            ForEach(IdeaCanvasVersionFormat.allCases) { format in
                tab(format)
            }
            Spacer(minLength: 0)
        }
        .overlay(alignment: .bottom) { Rectangle().fill(Color.studioLine).frame(height: 1) }
    }

    private func tab(_ format: IdeaCanvasVersionFormat) -> some View {
        let on = selection == format
        let exists = existing.contains(format)
        return Button { withAnimation(.snappy(duration: 0.18)) { selection = format } } label: {
            HStack(spacing: 7) {
                if exists || writing == format {
                    Circle().fill(format.tone.color).frame(width: 7, height: 7)
                } else {
                    Image(systemName: "plus")
                        .font(.system(size: 9, weight: .bold))
                        .frame(width: 15, height: 15)
                        .overlay(RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .strokeBorder(Color.studioLineStrong, style: StrokeStyle(lineWidth: 1, dash: [2, 2])))
                }
                Text(format.label)
                    .font(.system(size: 13, weight: on ? .semibold : .medium))
                if format == lead {
                    Text("Lead")
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6).padding(.vertical, 1)
                        .background(Capsule().fill(Color.studioFaintFill))
                        .help("This idea started as \(format.label.lowercased()). The other versions are written from it by default.")
                }
            }
            .foregroundStyle(on ? Color.primary : exists ? Color.secondary : Color.secondary.opacity(0.7))
            .padding(.vertical, 11)
            .overlay(alignment: .bottom) {
                if on {
                    Capsule().fill(Color.yapperOrange).frame(height: 2).offset(y: 0.5)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .contextMenu {
            if exists && format != lead {
                Button("Delete the \(format.noun)…", role: .destructive) { onDelete(format) }
            }
        }
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityLabel(exists ? format.label : "\(format.label), not written yet")
    }
}
