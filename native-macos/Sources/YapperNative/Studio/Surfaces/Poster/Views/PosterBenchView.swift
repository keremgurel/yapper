import SwiftUI

/// The source stays compact. The cover editor and publishing settings open on
/// top of the composer so its rows never change position.
struct PosterBenchView: View {
    let video: PosterVideo
    @ObservedObject var bench: PosterBench
    @ObservedObject var upload: PosterUploadStore
    @ObservedObject var drafts: PosterDraftStore
    @ObservedObject var connections: PosterConnectionStore
    @State private var editingCover = false
    @State private var locked = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Create your post").font(.nativeSectionTitle).padding(.bottom, 14)
            Divider()
            PosterComposerRow(label: "Video") {
                HStack(spacing: 12) {
                    let cover = drafts.cover(video)
                    Group {
                        if cover.image != nil { PosterCoverPreview(draft: cover, compact: true) }
                        else { PosterVideoStill(video: video, iconSize: 12) }
                    }
                    .frame(width: 34, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 5))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(video.title).font(.system(size: 13, weight: .semibold)).lineLimit(2)
                            .help(video.title)
                        Text(video.platform.map { "From \($0.label)" } ?? "From your library")
                            .font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 4)
                    Button("Edit cover") { editingCover = true }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                        .disabled(locked || video.needsOriginal || !canEditCover)
                    Button("Change video") { bench.close() }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                        .disabled(locked)
                }
            }
            if video.needsOriginal {
                PosterComposerRow(label: "Original file") {
                    PosterAttachOriginal(video: video, upload: upload)
                }
            }
            PosterDestinationColumn(video: video, drafts: drafts, connections: connections,
                                    generator: .shared, prep: .shared, locked: $locked)
        }
        .sheet(isPresented: $editingCover) {
            PosterCoverStudio(video: video, initial: drafts.cover(video)) {
                drafts.setCover($0, for: video)
            }
        }
        .task(id: video.id) {
            guard !drafts.hasCover(video), let path = video.originalThumbnailPath,
                  let data = try? await PosterHTTP.bytes(path),
                  let image = PosterImageData.image(from: data),
                  !Task.isCancelled, !drafts.hasCover(video) else { return }
            var cover = drafts.cover(video)
            cover.source = .original
            cover.image = image
            drafts.setCover(cover, for: video)
        }
    }

    private var canEditCover: Bool {
        video.readyToPublish || video.previewURL != nil || drafts.cover(video).image != nil
    }
}
