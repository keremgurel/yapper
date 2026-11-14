import SwiftUI

/// What the panel says before anything has been imported.
struct MediaEmptyState: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                StudioGlyph(.media, size: 22)
                    .foregroundStyle(Color.studioTextMuted)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 4) {
                    Text("No media yet")
                        .font(.studioBodyStrong)
                    Text("Drag videos or images in from Finder, or import them. They stay local on this Mac.")
                        .font(.studioCaption)
                        .foregroundStyle(Color.studioTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Button {
                ImportPanels.openMedia(for: session)
            } label: {
                StudioGlyphLabel("Import media", glyph: .plus, size: 13)
            }
            .buttonStyle(EditorPrimaryButtonStyle())
            .disabled(session.isBusy)
        }
        .padding(16)
        .frame(maxWidth: 440, alignment: .leading)
        .background(
            Color.raisedBackground,
            in: RoundedRectangle(cornerRadius: StudioRadius.field, style: .continuous)
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
