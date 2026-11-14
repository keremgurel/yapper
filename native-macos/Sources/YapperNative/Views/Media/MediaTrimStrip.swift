import SwiftUI

/// A file laid out end to end with a handle at each end of the part to keep.
///
/// The handles and frame are orange because they are drawn over footage, the
/// same as the trim handles on the timeline.
struct MediaTrimStrip: View {
    static let height: CGFloat = 52
    private static let handleWidth: CGFloat = 10
    private static let space = "mediaTrimStrip"

    let thumbnails: [CGImage]
    let waveform: [Float]
    @Binding var range: MediaTrimRange
    /// The moment under the handle being dragged, so the row can show it.
    let onScrub: (Double?) -> Void

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let startX = x(range.start, in: width)
            let endX = x(range.end, in: width)
            ZStack(alignment: .topLeading) {
                footage.frame(width: width, height: Self.height)
                // Everything outside the range, dimmed rather than hidden: the
                // way back out to it stays in view.
                Color.black.opacity(0.6).frame(width: max(0, startX))
                Color.black.opacity(0.6)
                    .frame(width: max(0, width - endX))
                    .offset(x: endX)
                RoundedRectangle(cornerRadius: StudioRadius.tag, style: .continuous)
                    .strokeBorder(Color.yapperOrange, lineWidth: 2)
                    .frame(width: max(Self.handleWidth * 2, endX - startX))
                    .offset(x: startX)
                    .allowsHitTesting(false)
                handle(at: startX, label: "Start of the part to add") { time in
                    range = range.movingStart(to: time)
                    onScrub(range.start)
                }
                handle(at: endX - Self.handleWidth, label: "End of the part to add") { time in
                    range = range.movingEnd(to: time)
                    onScrub(range.end)
                }
            }
            .coordinateSpace(name: Self.space)
            .clipShape(RoundedRectangle(cornerRadius: StudioRadius.control, style: .continuous))
        }
        .frame(height: Self.height)
    }

    private var footage: some View {
        ZStack(alignment: .bottom) {
            HStack(spacing: 0) {
                ForEach(Array(thumbnails.enumerated()), id: \.offset) { _, image in
                    // An equal slot per frame. Sized by the slot, not the
                    // picture, or a row of tall frames is wider than the strip.
                    Color.clear
                        .overlay {
                            Image(decorative: image, scale: 1)
                                .resizable()
                                .scaledToFill()
                        }
                        .clipped()
                }
            }
            .background(Color.black)
            MediaTrimWaveform(peaks: waveform)
                .frame(height: 18)
                .padding(.horizontal, 1)
        }
    }

    private func handle(
        at offset: CGFloat,
        label: String,
        onMove: @escaping (Double) -> Void
    ) -> some View {
        GeometryReader { geometry in
            Color.yapperOrange
                .overlay {
                    Capsule().fill(Color.black.opacity(0.45)).frame(width: 2, height: 16)
                }
                .contentShape(Rectangle().inset(by: -6))
                .cursor(.resizeLeftRight)
                .gesture(
                    DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.space))
                        .onChanged { value in
                            let width = geometry.size.width
                            guard width > 0, range.duration > 0 else { return }
                            onMove(Double(value.location.x / width) * range.duration)
                        }
                        .onEnded { _ in onScrub(nil) }
                )
                .frame(width: Self.handleWidth)
                .offset(x: offset)
                .accessibilityLabel(label)
        }
    }

    private func x(_ time: Double, in width: CGFloat) -> CGFloat {
        guard range.duration > 0 else { return 0 }
        return CGFloat(time / range.duration) * width
    }
}
