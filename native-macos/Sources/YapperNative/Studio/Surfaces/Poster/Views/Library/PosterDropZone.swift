import SwiftUI

/// Where a finished export goes. The whole band opens the file picker, and
/// it lights up while a file is dragged over the page, because a drop
/// anywhere on the step lands here.
struct PosterDropZone: View {
    let dragging: Bool
    let busy: Bool
    let onChoose: () -> Void
    @State private var hovering = false

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: StudioRadius.card, style: .continuous) }

    var body: some View {
        Button(action: onChoose) {
            HStack(spacing: 16) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(dragging ? Color.primary : Color.secondary)
                    .frame(width: 48, height: 48)
                    .background(Circle().fill(Color.panelBackground))
                VStack(alignment: .leading, spacing: 4) {
                    Text(dragging ? "Drop to upload" : busy ? "Uploading your video…" : "Drop a video here")
                        .font(.studioSectionTitle)
                    Text("MP4 or MOV. It opens ready to post.").font(.studioBody).foregroundStyle(.secondary)
                }
                Spacer(minLength: 12)
                Text("Choose a file").font(.studioBody)
                    .padding(.horizontal, 14).frame(height: 32)
                    .background(Capsule().fill(Color.raisedBackground))
                    .overlay(Capsule().strokeBorder(Color.studioLineStrong, lineWidth: 0.5))
                    .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
            }
            .padding(.horizontal, 24).padding(.vertical, 20)
            .background(shape.fill(dragging || hovering ? Color.panelBackground : Color.studioInputBackground))
            .overlay(shape.strokeBorder(dragging ? Color.studioAccent : Color.studioLineStrong,
                                        style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])))
            .contentShape(shape)
        }
        .buttonStyle(.studioPlain)
        .disabled(busy)
        .opacity(busy ? 0.6 : 1)
        .onHover { hovering = $0 }
        .animation(.easeInOut(duration: 0.15), value: dragging)
        .accessibilityLabel("Upload a video")
        .accessibilityHint("Opens the file picker. You can also drop a video anywhere on this page.")
    }
}
