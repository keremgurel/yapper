import SwiftUI

/// What a file is called and how big it is.
struct MediaRowDetails: View {
    let media: ProjectMedia
    let waveformProgress: Double?
    let usage: MediaUsage

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(media.name)
                .font(.studioBodyStrong)
                .lineLimit(2)
                .truncationMode(.middle)
                .help(media.name)
            if let generated = media.generated {
                Text(generated.description)
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
                    .lineLimit(2)
                    .help("Mention @\(media.name) in Chirpy to request changes")
            }
            Text(facts)
                .font(.studioCaption)
                .foregroundStyle(Color.studioTextMuted)
                .lineLimit(1)
            placement
            if let waveformProgress, waveformProgress < 1 {
                ProgressView(value: waveformProgress)
                    .tint(Color.studioAccent)
                    .help("Drawing the waveform")
            }
        }
        // Wide enough to read a camera's file name, and the width the row asks
        // for before it decides whether the buttons fit beside it.
        .frame(minWidth: 80, idealWidth: 210, maxWidth: .infinity, alignment: .leading)
    }

    /// Where the file already is on the timeline, so a file that has been
    /// placed is told from one that has not without scrolling the timeline.
    private var placement: some View {
        HStack(spacing: 5) {
            if let placed = usage.summary {
                Circle().fill(Color.studioSuccess).frame(width: 6, height: 6)
                Text(placed)
                    .foregroundStyle(Color.primary.opacity(0.85))
            } else {
                Circle().strokeBorder(Color.studioLineStrong, lineWidth: 1).frame(width: 6, height: 6)
                Text("Not placed yet")
                    .foregroundStyle(Color.studioTextMuted)
            }
        }
        .font(.studioCaption)
        .lineLimit(1)
        .help(usage.isPlaced
            ? "This file is already on the timeline. Click it to see which parts are in use."
            : "This file is in the project but not on the timeline")
    }

    /// Plain digits: a frame size is not a quantity, so it takes no grouping
    /// comma.
    private var facts: String {
        "\(String(media.width)) × \(String(media.height))"
    }
}
