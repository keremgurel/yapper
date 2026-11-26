import SwiftUI

/// The entire band opens the file picker and shows when the page can accept a drop.
struct PosterDropZone: View {
    let dragging: Bool
    let busy: Bool
    let onChoose: () -> Void
    @State private var hovering = false

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: StudioRadius.card, style: .continuous) }

    var body: some View {
        Button(action: onChoose) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) {
                    prompt.fixedSize()
                    Spacer(minLength: 12)
                    fileLabel
                }
                VStack(alignment: .leading, spacing: 10) {
                    prompt
                    fileLabel
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(shape.fill(dragging || hovering ? Color.panelBackground : Color.studioInputBackground))
            .overlay(shape.strokeBorder(dragging ? Color.studioAccent : Color.studioLineStrong,
                                        style: StrokeStyle(lineWidth: dragging ? 2 : 1, dash: [5, 4])))
            .contentShape(shape)
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .disabled(busy)
        .opacity(busy ? 0.6 : 1)
        .onHover { hovering = $0 }
        .accessibilityLabel(busy ? "Uploading video" : "Upload a video")
        .accessibilityHint("Opens the file picker. You can also drop an MP4 or MOV video here.")
    }

    private var prompt: some View {
        HStack(spacing: 10) {
            Image(systemName: "square.and.arrow.up")
                .font(.studioSectionTitle)
                .frame(width: 36, height: 36)
                .background(Circle().fill(Color.panelBackground))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(busy ? "Uploading video…" : dragging ? "Drop to upload" : "Drop a video here")
                    .font(.studioBodyStrong)
                Text("MP4 or MOV").font(.studioLabel).foregroundStyle(.secondary)
            }
        }
    }

    private var fileLabel: some View {
        Text("Choose a file")
            .font(.studioBodyStrong)
            .padding(.horizontal, 12)
            .frame(height: 32)
            .background(Capsule().fill(Color.raisedBackground))
            .overlay(Capsule().strokeBorder(Color.studioLineStrong, lineWidth: 0.5))
            .fixedSize()
    }
}
