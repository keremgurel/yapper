import SwiftUI

/// Back a key, add or remove one here, forward a key: the same three controls
/// the video track has, in the same order, doing the same thing to a cutaway.
struct OverlayKeyframeControls: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    @ObservedObject private var clock: PlaybackClock

    init(session: EditorSession, overlay: ProjectOverlay) {
        self.session = session
        self.overlay = overlay
        self.clock = session.playbackClock
    }

    private var isOnKey: Bool { session.overlayKeyAtPlayhead(overlay) != nil }

    var body: some View {
        HStack(spacing: 2) {
            arrow("chevron.left", enabled: session.hasPreviousOverlayKey(overlay)) {
                session.goToPreviousOverlayKey(overlay)
            }
            .help("Previous keyframe")

            Button {
                session.toggleOverlayKey(overlay)
            } label: {
                Image(systemName: isOnKey ? "diamond.fill" : "diamond")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isOnKey ? Color.yapperOrange : Color.secondary)
                    .frame(width: 24, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .disabled(!session.isPlayheadOver(overlay))
            .help(isOnKey ? "Remove this keyframe" : "Add a keyframe here")
            .accessibilityLabel(isOnKey ? "Remove overlay keyframe" : "Add overlay keyframe")

            arrow("chevron.right", enabled: session.hasNextOverlayKey(overlay)) {
                session.goToNextOverlayKey(overlay)
            }
            .help("Next keyframe")

            if session.isOverlayKeyed(overlay) {
                Button("Clear") { session.clearOverlayKeys(overlay) }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
            }
        }
    }

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
