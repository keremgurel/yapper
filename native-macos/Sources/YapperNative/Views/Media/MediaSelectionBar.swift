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
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                picking
                Spacer(minLength: 12)
                acting
            }
            VStack(alignment: .leading, spacing: 8) {
                picking
                acting
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Color.studioTray,
            in: RoundedRectangle(cornerRadius: StudioRadius.field, style: .continuous)
        )
    }

    /// How many are picked, and the two ways to change that.
    private var picking: some View {
        HStack(spacing: 8) {
            Text("\(count) selected")
                .font(.studioLabelStrong)
                .monospacedDigit()

            Button("Select all") { session.selectAllMedia() }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                .help("Select every file in this project")

            Button("Deselect") { session.clearMediaSelection() }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                .help("Clear the selection")
        }
        .fixedSize()
    }

    /// What happens to the picked files.
    private var acting: some View {
        HStack(spacing: 8) {
            if placeableCount > 0 {
                Button {
                    Task { await session.appendSelectedMediaToTimeline() }
                } label: {
                    StudioGlyphLabel("Add to main track", glyph: .plus, size: 12)
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                .help("Add the selected files to the end of the main track")
            }

            Button(role: .destructive) {
                Task { await session.deleteSelectedMedia() }
            } label: {
                StudioGlyphLabel("Remove", glyph: .delete, size: 12)
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
            .help("Remove \(count) from this project. The source files are kept.")
        }
        .fixedSize()
    }
}
