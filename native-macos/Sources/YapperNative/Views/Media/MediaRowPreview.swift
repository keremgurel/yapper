import SwiftUI

/// A frame of a file, or a spinner until there is one, with its length in
/// the corner the way a video is shown everywhere else.
struct MediaRowPreview: View {
    let thumbnail: CGImage?
    /// Nil for a picture, which has no length.
    var duration: Double?

    var body: some View {
        Group {
            if let thumbnail {
                Image(decorative: thumbnail, scale: 1)
                    .resizable()
                    .scaledToFill()
            } else {
                Rectangle().fill(Color.black)
                    .overlay(ProgressView().controlSize(.small))
            }
        }
        .frame(width: 96, height: 56)
        // A file with a transparent background still needs a tile to sit on.
        .background(Color.studioTray)
        .clipped()
        .overlay(alignment: .bottomTrailing) {
            if let duration {
                Text(formatTime(duration))
                    .font(.studioTimecodeMicro)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                    .background(Color.black.opacity(0.62), in: RoundedRectangle(cornerRadius: StudioRadius.tag))
                    .padding(4)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: StudioRadius.control, style: .continuous))
    }
}
