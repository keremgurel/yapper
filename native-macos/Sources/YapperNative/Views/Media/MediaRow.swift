import SwiftUI

/// One file in the bin.
///
/// On one line when the pane is wide. When it is narrow the buttons move under
/// the name instead of squeezing it: the name is how a file is told from the
/// next one, so it never gives up its width to a button.
struct MediaRow: View {
    /// Held, not observed: everything the row draws with arrives as a value, so
    /// a waveform finishing on one file does not re-run the body of every other.
    let session: EditorSession
    let media: ProjectMedia
    let thumbnail: CGImage?
    let waveformProgress: Double?
    let isSelected: Bool
    let canOverlay: Bool
    let onClick: (MediaSelection.Modifier) -> Void

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) {
                summary
                actions
            }
            VStack(alignment: .leading, spacing: 10) {
                summary
                actions
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            isSelected ? Color.studioSelectedFill : Color.raisedBackground,
            in: RoundedRectangle(cornerRadius: StudioRadius.field, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: StudioRadius.field, style: .continuous)
                .strokeBorder(isSelected ? Color.studioLineStrong : .clear, lineWidth: 1)
        }
        .contentShape(Rectangle())
        // The whole row is the target, so picking several is a run of ordinary
        // clicks rather than a hunt for a checkbox.
        .onTapGesture { onClick(MediaRow.modifier()) }
        .contextMenu { MediaActions(session: session, media: media, canOverlay: canOverlay) }
    }

    /// What the keyboard was saying when the click landed.
    static func modifier() -> MediaSelection.Modifier {
        let flags = NSEvent.modifierFlags
        if flags.contains(.shift) { return .extend }
        if flags.contains(.command) { return .toggle }
        return .none
    }

    private var summary: some View {
        HStack(spacing: 12) {
            MediaRowPreview(thumbnail: thumbnail)
            MediaRowDetails(media: media, waveformProgress: waveformProgress)
        }
    }

    private var actions: some View {
        MediaRowActions(session: session, media: media, canOverlay: canOverlay)
    }
}
