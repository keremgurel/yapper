import SwiftUI

/// The first frame of a file, or a spinner until there is one.
struct MediaRowPreview: View {
    let thumbnail: CGImage?

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
        .clipShape(RoundedRectangle(cornerRadius: StudioRadius.control, style: .continuous))
    }
}
