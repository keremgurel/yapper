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
    /// True when the posting declaration above is all that is left to check.
    let needsConsent: Bool
    let onSend: () -> Void
    let onNext: () -> Void

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            if failures > 0 {
                Text("\(failures) destination\(failures == 1 ? "" : "s") failed. Successful posts were not rolled back.")
                    .font(.studioLabelStrong).foregroundStyle(Color.studioDanger)
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
                }
                .buttonStyle(EditorPrimaryButtonStyle())
                .disabled(!canSend || busy)
                if !busy && !waiting.isEmpty {
                    Text("Finish \(waiting.formatted(.list(type: .and))) above to publish.")
                        .font(.studioLabel).foregroundStyle(.secondary)
                } else if !busy && needsConsent {
                    Text("Check the box above to publish.")
                        .font(.studioLabel).foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }
}
