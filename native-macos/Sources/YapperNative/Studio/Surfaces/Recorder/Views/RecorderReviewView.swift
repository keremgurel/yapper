import AVKit
import SwiftUI

/// After a take: play it back, then open it in the editor or keep it in
/// Downloads. The take never leaves this Mac; there is no upload.
struct RecorderReviewView: View {
    let take: RecorderTake
    let title: String?
    let onRetake: () -> Void

    @State private var player: AVPlayer?
    @State private var message: String?
    @State private var opening = false

    var body: some View {
        HStack(alignment: .top, spacing: 28) {
            NativeVideoPlayer(player: player)
                .aspectRatio(9.0 / 16.0, contentMode: .fit)
                .frame(height: 620)
                .background(Color.black)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
            actions.frame(width: 340, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, alignment: .top)
        .onAppear { player = AVPlayer(url: take.url) }
        .onDisappear { player?.pause() }
        .onChange(of: take) { _, next in player = AVPlayer(url: next.url) }
    }

    private var actions: some View {
        NativeSection(title: "Your take", meta: title, card: true) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Edit it now, or keep the file. It stays on this Mac.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Button(action: openInEditor) {
                    HStack(spacing: 8) {
                        if opening { ProgressView().controlSize(.small) } else { Image(systemName: "scissors") }
                        Text(opening ? "Opening the editor…" : "Open in editor")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(EditorPrimaryButtonStyle())
                .disabled(opening)
                HStack(spacing: 8) {
                    Button { player?.pause(); onRetake() } label: {
                        Label("Retake", systemImage: "arrow.counterclockwise").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(EditorSecondaryButtonStyle())
                    .disabled(opening)
                    Button { message = RecorderDownload.toDownloads(take) } label: {
                        Label("Download", systemImage: "arrow.down.to.line").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(EditorSecondaryButtonStyle())
                }
                if let message {
                    Text(message).font(.system(size: 12, weight: .medium)).foregroundStyle(Color.studioDanger)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private func openInEditor() {
        player?.pause()
        do {
            let kept = try RecorderDownload.keepForEditor(take)
            opening = true
            StudioNavigation.shared.openInEditor(kept)
        } catch {
            message = "The take couldn't be kept for the editor. Check there is space, then try again."
        }
    }
}
