import SwiftUI

/// The trim strip with what it currently says underneath: where the part
/// starts and ends, how long it is, and the way back to the whole file.
struct MediaTrimPanel: View {
    let thumbnails: [CGImage]
    let waveform: [Float]
    @Binding var range: MediaTrimRange
    let onScrub: (Double?) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            MediaTrimStrip(thumbnails: thumbnails, waveform: waveform, range: $range, onScrub: onScrub)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) {
                    times
                    note.lineLimit(1).fixedSize()
                    Spacer(minLength: 8)
                    reset
                }
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        times
                        Spacer(minLength: 8)
                        reset
                    }
                    note.fixedSize(horizontal: false, vertical: true)
                }
                // The narrowest pane: one thing to a line.
                VStack(alignment: .leading, spacing: 4) {
                    times
                    note.fixedSize(horizontal: false, vertical: true)
                    reset
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var times: some View {
        Text("\(MediaTrimTime.text(range.start)) to \(MediaTrimTime.text(range.end))")
            .font(.studioTimecode)
            .lineLimit(1)
            .fixedSize()
    }

    private var note: some View {
        Text(summary)
            .font(.studioCaption)
            .foregroundStyle(Color.studioTextMuted)
    }

    @ViewBuilder
    private var reset: some View {
        if !range.isFull {
            Button("Use whole file") { range = MediaTrimRange(duration: range.duration) }
                .buttonStyle(EditorGhostButtonStyle(size: .mini))
                .fixedSize()
                .help("Put both ends back where the file starts and stops")
        }
    }

    private var summary: String {
        range.isFull
            ? "Drag either end to add only part of this file"
            : "\(MediaTrimTime.length(range.length)) will be added"
    }
}
