import SwiftUI

/// The empty place a reference thumbnail goes. Clicking it opens a file,
/// Paste takes the clipboard, and dropping works anywhere on the composer.
struct PosterReferenceSlot: View {
    let onChoose: () -> Void
    let onPaste: () -> Void

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 8, style: .continuous)
        VStack(spacing: 0) {
            Button(action: onChoose) {
                VStack(spacing: 6) {
                    Image(systemName: "photo.badge.plus").font(.system(size: 18)).foregroundStyle(.secondary)
                    Text("Reference").font(.system(size: 12, weight: .semibold))
                    Text("Drop or choose a thumbnail to copy its look")
                        .font(.system(size: 10)).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 10)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .clickableCursor()
            Button("Paste", systemImage: "doc.on.clipboard", action: onPaste)
                .buttonStyle(EditorGhostButtonStyle(size: .mini))
                .padding(.bottom, 6)
        }
        .frame(width: 148, height: PosterRemixAttachment.height)
        .background(shape.fill(Color.studioFaintFill))
        .overlay(shape.strokeBorder(Color.studioLineStrong, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
    }
}
