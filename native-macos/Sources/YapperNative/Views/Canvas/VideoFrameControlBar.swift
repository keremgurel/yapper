import SwiftUI

/// The framing controls, floating on the picture they act on.
///
/// A panel away in the inspector would be the tidier place for these, and the
/// wrong one: framing is something you do by eye, watching the picture, and a
/// control you have to look away from to reach breaks that loop. They appear
/// only while the picture is picked up.
struct VideoFrameControlBar: View {
    @ObservedObject var session: EditorSession
    /// Read here so the percentage keeps up with a drag in flight.
    @ObservedObject var drag: CanvasDragState

    private var framing: VideoFraming { session.displayedFraming }

    var body: some View {
        HStack(spacing: 6) {
            stepper

            Divider().frame(height: 16).opacity(0.4)

            // The diamond, where the picture is. Marking the start of a move is
            // something you do while looking at the shot, not at a panel.
            Button {
                session.toggleFramingKey()
            } label: {
                Image(systemName: session.framingKeyAtPlayhead != nil ? "diamond.fill" : "diamond")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(session.isFramingKeyed ? Color.yapperOrange : Color.primary)
                    .frame(width: 24, height: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .help(
                session.framingKeyAtPlayhead != nil
                    ? "Remove this keyframe"
                    : "Add a keyframe here, then move the playhead and change the zoom"
            )

            if session.framingFillScale != nil {
                Button("Fill frame") { session.fillFrameWithVideo() }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    .help("Zoom until the footage covers the whole frame, with no bars")
            }

            Button("Reset") { session.resetFraming() }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                .disabled(framing.isIdentity)
                .help("Put the picture back to fitted and centred")

            if session.project.clips.count > 1 {
                Button("All clips") { session.applyFramingToAllClips() }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    .help("Give every clip on the main track this framing")
            }
        }
        .padding(.horizontal, 8)
        .frame(height: 34)
        .studioGlassBackground(radius: 10)
        .overlay {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.yapperOrange.opacity(0.28), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.4), radius: 12, y: 5)
        .padding(.bottom, 12)
    }

    /// Coarse enough that one press is a visible change, fine enough to land on
    /// a number you meant.
    private static let step = 0.05

    private var stepper: some View {
        HStack(spacing: 2) {
            zoomButton("minus", to: framing.scale - Self.step)
                .disabled(framing.scale <= VideoFraming.minimumScale)
            Text("\(framing.percent)%")
                .font(.system(size: 11, weight: .bold))
                .monospacedDigit()
                .frame(width: 46)
            zoomButton("plus", to: framing.scale + Self.step)
                .disabled(framing.scale >= VideoFraming.maximumScale)
        }
    }

    private func zoomButton(_ symbol: String, to scale: Double) -> some View {
        Button {
            session.setFramingScale(scale)
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 10, weight: .bold))
                .frame(width: 24, height: 24)
                .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .help(symbol == "plus" ? "Zoom in" : "Zoom out")
    }
}
