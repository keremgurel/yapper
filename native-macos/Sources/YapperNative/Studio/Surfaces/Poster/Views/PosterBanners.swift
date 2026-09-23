import SwiftUI

/// The lines above the work that say what is happening right now: an upload
/// in flight, an import that failed, a cover that could not upload, or
/// connections that could not be refreshed.
struct PosterBanners: View {
    @ObservedObject var upload: PosterUploadStore
    @ObservedObject var bench: PosterBench
    @ObservedObject var prep: PosterPublishPrep
    @ObservedObject var connections: PosterConnectionStore

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let code = upload.errorCode, upload.phase == .failed {
                warning(PosterErrorCopy.upload(code))
            } else if upload.busy {
                progress
            } else if upload.transcriptFailed {
                warning("The video uploaded, but its transcript could not be prepared. Captions will use the title and your prompt.")
            }
            if let error = bench.error { warning(error) }
            if let warning = prep.warning { self.warning(warning) }
            if connections.failed {
                NativeErrorState(message: "Your connected accounts couldn't be refreshed.") {
                    Task { await connections.refresh() }
                }
            }
        }
    }

    private var progress: some View {
        let uploading = upload.phase == .uploading
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                if uploading {
                    Image(systemName: "icloud.and.arrow.up").foregroundStyle(Color.yapperOrange)
                } else {
                    ProgressView().controlSize(.small)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(uploading ? "Uploading the final export, \(Int(upload.progress * 100))%" : "Reading the video for captions")
                        .font(.system(size: 13, weight: .semibold))
                    Text(uploading ? "The video opens here as soon as it lands." : "The transcript grounds every platform draft.")
                        .font(.system(size: 12)).foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            GeometryReader { proxy in
                Rectangle().fill(Color.yapperOrange)
                    .frame(width: proxy.size.width * (uploading ? upload.progress : 1))
            }
            .frame(height: 3)
            .background(Color.studioFaintFill)
        }
        .background(NativeCardBackground(radius: 12))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func warning(_ text: String) -> some View {
        Text(text).font(.system(size: 13)).foregroundStyle(NativeChip.Tone.yellow.color)
            .fixedSize(horizontal: false, vertical: true)
    }
}
