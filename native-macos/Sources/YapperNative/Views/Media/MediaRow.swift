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
    /// Frames along the file. The first is the row's picture; all of them
    /// make the trim strip.
    let thumbnails: [CGImage]
    let waveform: [Float]
    let waveformProgress: Double?
    let isSelected: Bool
    let canOverlay: Bool
    /// The part of the file chosen so far. Bound only while the row can trim.
    let trim: Binding<MediaTrimRange>?
    let isTrimming: Bool
    let onToggleTrim: () -> Void
    let onClick: (MediaSelection.Modifier) -> Void
    /// The moment under a trim handle while it is dragged, shown as the row's
    /// picture so the cut point can be seen.
    @State private var scrubTime: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
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
            if isTrimming, let trim {
                MediaTrimPanel(
                    thumbnails: thumbnails,
                    waveform: waveform,
                    range: trim,
                    onScrub: { scrubTime = $0 }
                )
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
            MediaRowPreview(thumbnail: frame)
            MediaRowDetails(media: media, waveformProgress: waveformProgress)
        }
    }

    private var actions: some View {
        MediaRowActions(
            session: session,
            media: media,
            canOverlay: canOverlay,
            range: chosenRange,
            isTrimming: trim == nil ? nil : isTrimming,
            onToggleTrim: onToggleTrim
        )
    }

    /// The trimmed part, or nil while the whole file is still chosen.
    private var chosenRange: MediaTrimRange? {
        guard let range = trim?.wrappedValue, !range.isFull else { return nil }
        return range
    }

    /// The frame nearest the handle being dragged, else the first one.
    private var frame: CGImage? {
        guard let scrubTime, media.duration > 0, thumbnails.count > 1 else { return thumbnails.first }
        let index = Int(scrubTime / media.duration * Double(thumbnails.count))
        return thumbnails[min(thumbnails.count - 1, max(0, index))]
    }
}
