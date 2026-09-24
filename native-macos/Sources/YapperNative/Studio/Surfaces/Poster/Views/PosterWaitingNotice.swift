import SwiftUI

/// Shown when a new video was refused because another one is already waiting
/// to be posted. One video waits at a time: post it, schedule it, or discard it.
struct PosterWaitingNotice: View {
    @ObservedObject var upload: PosterUploadStore
    let waiting: PosterWaitingVideo

    private var name: String { waiting.title?.isEmpty == false ? waiting.title! : "Another video" }

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: "tray.full")
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(name) is still waiting to be posted.")
                    .font(.system(size: 13, weight: .semibold))
                Text(waiting.kind == "upload"
                     ? "Poster keeps one video at a time. Post or schedule it, or discard it to add the new one."
                     : "Poster keeps one video at a time. Post or schedule it first, then add the new one.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 12)
            Button("Keep it") { upload.keepWaiting() }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
            if waiting.kind == "upload" {
                Button {
                    Task { await upload.discardWaitingAndAdd() }
                } label: {
                    HStack(spacing: 6) {
                        if upload.discarding { ProgressView().controlSize(.mini) }
                        Text("Discard it and add the new one")
                    }
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .disabled(upload.discarding)
            }
        }
        .nativeCard(padding: 16)
    }
}
