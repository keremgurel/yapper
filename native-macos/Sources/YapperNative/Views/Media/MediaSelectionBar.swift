import SwiftUI

/// What to do with everything that is picked.
///
/// Only there once something is: a bar of disabled buttons above an empty
/// selection is a row of things that look broken.
struct MediaSelectionBar: View {
    @ObservedObject var session: EditorSession

    private var count: Int { session.mediaSelection.count }

    private var placeableCount: Int {
        session.project.media.filter {
            session.mediaSelection.contains($0.id) && !$0.isImage
        }.count
    }

    var body: some View {
        HStack(spacing: 10) {
            Text("\(count) selected")
                .font(.studioBodyStrong)

            Button("Select all") { session.selectAllMedia() }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))

            Button("Deselect") { session.clearMediaSelection() }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))

            Spacer(minLength: 8)

            if placeableCount > 0 {
                Button {
                    Task { await session.appendSelectedMediaToTimeline() }
                } label: {
                    Label("Add to main track", systemImage: "rectangle.stack.badge.plus")
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
            }

            Button(role: .destructive) {
                Task { await session.deleteSelectedMedia() }
            } label: {
                Label("Remove", systemImage: "trash")
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
            .help("Remove \(count) from this project · the source files are kept")
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 8)
        .background(Color.yapperOrange.opacity(0.13))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(Color.yapperOrange.opacity(0.45), lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}
