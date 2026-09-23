import SwiftUI

/// A video's still. Channel posts carry a thumbnail URL; Yapper takes get a
/// frame pulled from their master in the background. Either way the page
/// never waits for it: a quiet placeholder holds the space.
struct PosterVideoStill: View {
    let video: PosterVideo
    var iconSize: CGFloat = 18
    @State private var frame: CGImage?

    var body: some View {
        // The image hangs off a fixed rectangle as an overlay: inside a
        // ZStack a fill-scaled image grows the stack itself, and a wide still
        // spilled over the cards beside it.
        Rectangle()
            .fill(Color.studioInputBackground)
            .overlay {
                if let frame {
                    Image(decorative: frame, scale: 1).resizable().scaledToFill()
                } else if case let .platform(_, _, _, thumbnail?, _, _, _, _, _) = video.origin {
                    AsyncImage(url: thumbnail) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill()
                        } else {
                            placeholder
                        }
                    }
                } else {
                    placeholder
                }
            }
        .clipped()
        .task(id: video.id) {
            guard video.submissionID != nil else { return }
            if let cached = await PosterThumbnailCache.shared.cached(video.media) {
                frame = cached
            } else {
                frame = await PosterThumbnailCache.shared.image(for: video.media)
            }
        }
    }

    private var placeholder: some View {
        Image(systemName: "film").font(.system(size: iconSize)).foregroundStyle(.tertiary)
    }
}
