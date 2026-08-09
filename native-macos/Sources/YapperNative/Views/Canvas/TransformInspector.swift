import SwiftUI

/// Scale and position for the speaker's own picture, with a keyframe on each.
///
/// The canvas is where you frame a shot by eye, and it is the wrong place to
/// build a move: a push-in is two moments and the line between them, and you
/// cannot see two moments at once. So the numbers live here, next to the
/// diamond that marks the moment, and the two halves of the gesture are one
/// panel apart rather than one panel and a guess.
///
/// The keyframe controls follow the shape every editor uses: an arrow back to
/// the previous key, a diamond that is filled when you are standing on one, an
/// arrow forward to the next.
struct TransformInspector: View {
    @ObservedObject var session: EditorSession
    /// Watched so the numbers follow a drag on the canvas as it happens.
    @ObservedObject var drag: CanvasDragState
    /// Watched so they also follow the playhead, which is what makes a keyed
    /// clip readable: park on each key and the panel says what it holds.
    @ObservedObject var clock: PlaybackClock

    private var framing: VideoFraming { session.displayedFraming }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            essentials
            Divider().opacity(0.45)
            InspectorSection("Position", id: "video.position") {
                positionRow
                if session.isFramingKeyed { keyframeSummary }
            }
        }
    }

    /// Scale and the keyframe row, always on screen: the size of the shot is
    /// what anyone opens this panel for, and the diamond has to be next to the
    /// thing it records.
    private var essentials: some View {
        VStack(alignment: .leading, spacing: 9) {
            InspectorRow("Scale") {
                InspectorSlider(
                    value: Double(framing.percent),
                    range: VideoFraming.minimumScale * 100 ... VideoFraming.maximumScale * 100,
                    decimals: 0
                ) { percent in
                    session.setFramingScale(percent / 100)
                }
            }

            InspectorRow("Keyframe") {
                KeyframeControls(session: session, clock: clock)
                Text(session.isFramingKeyed ? "This shot moves" : "Mark the start of a move")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 10)
    }

    private var positionRow: some View {
        InspectorRow("Offset") {
            // In percent of the frame, the same units the box on the canvas is
            // measured in. Pixels would mean something different for every
            // aspect ratio the project could be exported at.
            HStack(spacing: 7) {
                Text("X").font(.studioCaption).foregroundStyle(.secondary)
                InspectorNumberField(
                    value: (framing.x * 100).rounded(),
                    range: -150 ... 150,
                    decimals: 0
                ) { percent in
                    session.setFramingOffset(x: percent / 100, y: framing.y)
                }
                Text("Y").font(.studioCaption).foregroundStyle(.secondary)
                InspectorNumberField(
                    value: (framing.y * 100).rounded(),
                    range: -150 ... 150,
                    decimals: 0
                ) { percent in
                    session.setFramingOffset(x: framing.x, y: percent / 100)
                }
            }
        }
    }

    private var keyframeSummary: some View {
        InspectorRow("Move") {
            HStack(spacing: 8) {
                Text(summary)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                Button("Clear") { session.clearFramingKeys() }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
            }
        }
    }

    private var summary: String {
        let count = session.framingKeys.count
        return count == 1
            ? "1 keyframe · move the playhead and change the scale"
            : "\(count) keyframes"
    }
}

/// Back a key, add or remove one here, forward a key.
private struct KeyframeControls: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var clock: PlaybackClock

    var body: some View {
        HStack(spacing: 2) {
            arrow("chevron.left", enabled: session.hasPreviousFramingKey) {
                session.goToPreviousFramingKey()
            }
            .help("Previous keyframe")

            Button {
                session.toggleFramingKey()
            } label: {
                Image(systemName: isOnKey ? "diamond.fill" : "diamond")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isOnKey ? Color.yapperOrange : Color.secondary)
                    .frame(width: 24, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .disabled(session.project.clips.isEmpty)
            .help(isOnKey ? "Remove this keyframe" : "Add a keyframe here")

            arrow("chevron.right", enabled: session.hasNextFramingKey) {
                session.goToNextFramingKey()
            }
            .help("Next keyframe")
        }
    }

    private var isOnKey: Bool { session.framingKeyAtPlayhead != nil }

    private func arrow(
        _ icon: String,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .bold))
                .frame(width: 18, height: 22)
                .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .disabled(!enabled)
    }
}
