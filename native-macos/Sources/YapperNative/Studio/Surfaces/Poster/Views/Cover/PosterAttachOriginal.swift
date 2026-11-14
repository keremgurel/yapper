import SwiftUI

/// The step a YouTube post opens on when Yapper kept no file for it: attach
/// the creator's own original through the normal upload path. The post's
/// title and caption stay, and the file also lands in Uploads.
struct PosterAttachOriginal: View {
    let video: PosterVideo
    @ObservedObject var upload: PosterUploadStore

    var body: some View {
        let platform = video.platform?.label ?? "channel"
        let mine = upload.attachingID == video.id
        let sending = mine && upload.busy
        VStack(alignment: .leading, spacing: 14) {
            Text("Choose the original file for this \(platform) post. Your title and caption stay in place. The file also appears in Uploads.")
                .font(.studioBody).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Button { upload.attach(to: video) } label: {
                HStack(spacing: 6) {
                    if sending { ProgressView().controlSize(.mini) } else { Image(systemName: "square.and.arrow.up") }
                    Text(sending ? "Attaching video…" : "Attach original video")
                }
            }
            .buttonStyle(EditorPrimaryButtonStyle())
            .disabled(upload.busy)
            Text("Use a video file you own, such as an MP4 or MOV. Yapper does not download this post from \(platform).")
                .font(.studioLabel).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if mine { status }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .nativeCard(padding: 20, radius: 12)
    }

    @ViewBuilder
    private var status: some View {
        switch upload.phase {
        case .uploading:
            VStack(alignment: .leading, spacing: 6) {
                ProgressView(value: upload.progress).tint(Color.studioAccent)
                Text("Uploading \(Int(upload.progress * 100))%").font(.studioLabel.monospacedDigit()).foregroundStyle(.secondary)
            }
        case .preparing:
            Text("Reading the video").font(.studioLabel).foregroundStyle(.secondary)
        case .failed:
            Text(PosterErrorCopy.upload(upload.errorCode ?? "failed"))
                .font(.studioLabel).foregroundStyle(NativeChip.Tone.yellow.color)
                .fixedSize(horizontal: false, vertical: true)
        case .idle:
            EmptyView()
        }
    }
}
