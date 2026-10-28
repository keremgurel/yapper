import SwiftUI

/// The one button, pinned under the column: it prepares the video and sends
/// it to every chosen destination, or schedules it. Once everything is out,
/// it becomes the way on to the next video.
struct PosterPublishBar: View {
    let label: String
    let busy: Bool
    let canSend: Bool
    let finished: Bool
    let failures: Int
    /// Destinations to finish before the button opens, by name.
    let waiting: [String]
    let tiktokChosen: Bool
    let onSend: () -> Void
    let onNext: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            if failures > 0 {
                Text("\(failures) destination\(failures == 1 ? "" : "s") failed. Successful posts were not rolled back.")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.studioDanger)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if finished {
                Button("Post another video", action: onNext)
                    .buttonStyle(EditorPrimaryButtonStyle())
            } else {
                Button(action: onSend) {
                    HStack(spacing: 6) {
                        if busy { ProgressView().controlSize(.mini) }
                        Text(label)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(EditorPrimaryButtonStyle())
                .disabled(!canSend || busy)
                if !busy && !waiting.isEmpty {
                    Text("Finish \(waiting.formatted(.list(type: .and))) above to publish.")
                        .font(.system(size: 12)).foregroundStyle(.secondary)
                } else if tiktokChosen {
                    Text("For TikTok, review the audience and posting method above.")
                        .font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
        }
        .nativeCard(padding: 12, radius: 12)
    }
}
