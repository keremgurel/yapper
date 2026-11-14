import SwiftUI

/// What to do with the selected words. It floats over the bottom of the
/// transcript, so it is there wherever the selection was made.
struct TranscriptSelectionBar: View {
    let selectedCount: Int
    let restorableCount: Int
    let deletableCount: Int
    let onRestore: () -> Void
    let onDelete: () -> Void
    let onClear: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Text("\(selectedCount) selected")
                .font(.studioCaptionStrong)
                .monospacedDigit()
                .padding(.horizontal, 6)

            if restorableCount > 0 {
                Button("Restore \(restorableCount)", action: onRestore)
                    .buttonStyle(TranscriptActionButtonStyle(fill: .studioSuccess, label: .white))
                    .help("Put the selected cut words back into the video")
            }

            if deletableCount > 0 {
                Button(action: onDelete) {
                    StudioGlyphLabel("Delete \(deletableCount)", glyph: .delete, size: 12)
                }
                .buttonStyle(TranscriptActionButtonStyle(fill: .studioDanger, label: .white))
                .help("Cut the selected words out of the video")
            }

            Button("Clear", action: onClear)
                .buttonStyle(TranscriptActionButtonStyle(fill: .studioFaintFill, label: .primary))
                .help("Clear the selection")
        }
        .fixedSize()
        .padding(6)
        .background(
            .regularMaterial,
            in: RoundedRectangle(cornerRadius: StudioRadius.panel, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: StudioRadius.panel, style: .continuous)
                .stroke(Color.studioLine, lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.2), radius: 12, y: 4)
    }
}

/// A filled pill: the bar says what each button will do by its colour.
private struct TranscriptActionButtonStyle: ButtonStyle {
    let fill: Color
    let label: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.studioCaptionStrong)
            .foregroundStyle(label)
            .padding(.horizontal, 10)
            .frame(height: 26)
            .background(fill.opacity(configuration.isPressed ? 0.75 : 1), in: Capsule())
            .contentShape(Capsule())
    }
}
