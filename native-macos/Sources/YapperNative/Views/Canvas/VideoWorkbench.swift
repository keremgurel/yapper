import SwiftUI

/// The speaker's own picture: where it sits in the frame, and how it moves.
///
/// Framing has been dragged on the canvas since it existed, which is right for
/// choosing a shot and useless for building a move: a push-in is two moments,
/// and the canvas only ever shows you one. The numbers and the keyframes live
/// here, where both ends of a move can be reached without losing your place.
struct VideoWorkbench: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header

                if session.project.clips.isEmpty {
                    Text("Import a video to frame it.")
                        .font(.studioBody)
                        .foregroundStyle(.secondary)
                } else {
                    TransformInspector(
                        session: session,
                        drag: session.canvasDrag,
                        clock: session.playbackClock
                    )
                    Divider().opacity(0.45)
                    shortcuts
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .frame(maxWidth: 620, alignment: .leading)
        }
        .inspectorPane(maxWidth: 660)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("Video")
                .font(.system(size: 15, weight: .bold))
            Text("Frame the shot, or keyframe a push-in · these act on the clip under the playhead")
                .font(.studioBody)
                .foregroundStyle(.secondary)
        }
        .padding(.bottom, 12)
    }

    private var shortcuts: some View {
        HStack(spacing: 8) {
            if session.framingFillScale != nil {
                Button("Fill frame") { session.fillFrameWithVideo() }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    .help("Zoom until the footage covers the whole frame, with no bars")
            }
            if session.project.clips.count > 1 {
                Button("Apply to all clips") { session.applyFramingToAllClips() }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    .help("Give every clip on the main track this framing")
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 10)
    }
}
