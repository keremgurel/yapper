import SwiftUI

/// The parts of a file already on the timeline, as marks on a thin lane under
/// its trim strip. Its own lane, not a line over the picture: the trim frame
/// covers the picture's edges, and a mark has to read on any footage.
struct MediaUsedLane: View {
    let parts: [MediaUsage.Part]
    let duration: Double

    var body: some View {
        Canvas { context, size in
            let lane = Path(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 2)
            context.fill(lane, with: .color(Color.studioTray))
            guard duration > 0 else { return }
            context.clip(to: lane)
            for part in parts {
                let x = part.start / duration * size.width
                let width = max(2, (part.end - part.start) / duration * size.width)
                context.fill(
                    Path(CGRect(x: x, y: 0, width: width, height: size.height)),
                    with: .color(Color.studioSuccess)
                )
            }
        }
        .frame(height: 5)
        .padding(.top, -3)
        .help("Already on the timeline")
        .accessibilityElement()
        .accessibilityLabel("\(parts.count) parts of this file are already on the timeline")
    }
}
