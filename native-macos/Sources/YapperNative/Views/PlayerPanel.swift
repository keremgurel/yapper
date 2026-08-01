import SwiftUI

struct PlayerPanel: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Color.black
                if session.project.clips.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "play.rectangle")
                            .font(.system(size: 34, weight: .light))
                            .foregroundStyle(.secondary)
                        Text("Native preview")
                            .font(.system(size: 14, weight: .bold))
                        Text("Import one or several videos. The editor opens directly here.")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                } else {
                    NativePlayerView(player: session.player)
                        .id(ObjectIdentifier(session.player))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            TransportBar(session: session)
        }
        .background(Color.editorBackground)
    }
}

private struct TransportBar: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        HStack(spacing: 10) {
            Button {
                session.togglePlayback()
            } label: {
                Image(systemName: session.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 13, weight: .bold))
                    .frame(width: 30, height: 30)
            }
            .buttonStyle(.plain)
            .background(Color.studioFaintFill)
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .disabled(session.project.clips.isEmpty)

            Text("\(formatTimePrecise(session.currentTime)) / \(formatTimePrecise(session.duration))")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(.secondary)

            Spacer()

            Button {
                Task { await session.splitAtPlayhead() }
            } label: {
                Label("Split", systemImage: "scissors")
            }
            .buttonStyle(EditorSecondaryButtonStyle())
            .disabled(session.project.clips.isEmpty)

            Button {
                Task { await session.deleteSelected() }
            } label: {
                Label("Delete", systemImage: "trash")
            }
            .buttonStyle(EditorSecondaryButtonStyle())
            .disabled(session.selectedClipID == nil)
        }
        .padding(.horizontal, 14)
        .frame(height: 48)
        .background(Color.panelBackground)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }
}

func formatTimePrecise(_ seconds: Double) -> String {
    guard seconds.isFinite else { return "0:00.00" }
    let safe = max(0, seconds)
    let minutes = Int(safe) / 60
    let remainder = safe - Double(minutes * 60)
    return String(format: "%d:%05.2f", minutes, remainder)
}
