import SwiftUI

/// What a file is called and how big it is.
struct MediaRowDetails: View {
    let media: ProjectMedia
    let waveformProgress: Double?

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

    /// Plain digits: a frame size is not a quantity, so it takes no grouping
    /// comma.
    private var facts: String {
        "\(String(media.width)) × \(String(media.height)) · \(formatTime(media.duration))"
    }
}
