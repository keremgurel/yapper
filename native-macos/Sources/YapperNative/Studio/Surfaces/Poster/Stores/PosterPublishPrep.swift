import Foundation

/// Turns the open video into what the publish sheet posts: the cover is
/// rendered and uploaded here, and the video carries its captions per
/// platform. A cover that fails to upload never blocks the post.
@MainActor
final class PosterPublishPrep: ObservableObject {
    static let shared = PosterPublishPrep()

    @Published private(set) var preparing = false
    @Published private(set) var warning: String?
    /// Set when the sheet should open.
    @Published var sheet: PosterPublishSheetRequest?

    func prepare(_ video: PosterVideo, cover: PosterCoverDraft, captions: PosterCaptionSet, destinations: Set<PublishPlatform>) async {
        guard !preparing else { return }
        preparing = true
        warning = nil
        defer { preparing = false }
        var thumbnailKey: String?
        if cover.image != nil {
            if let png = PosterCoverRenderer.png(cover) {
                thumbnailKey = try? await PosterFileUpload.uploadCover(png: png)
            }
            if thumbnailKey == nil { warning = "The cover couldn't upload. The video is still ready to publish." }
        }
        let headline = cover.headline.trimmingCharacters(in: .whitespacesAndNewlines)
        let target = PosterPublishTarget(
            id: video.id,
            title: video.title,
            fallbackTitle: headline.isEmpty ? video.title : headline,
            captions: captions,
            submissionID: video.submissionID,
            mediaKey: video.mediaKey,
            contentItemID: video.contentItemID,
            thumbnailKey: thumbnailKey
        )
        sheet = PosterPublishSheetRequest(targets: [target], platforms: destinations)
    }
}

/// What the sheet opens with: the prepared videos and the destinations
/// chosen upstream, still visible and still removable there.
struct PosterPublishSheetRequest: Identifiable {
    let id = UUID()
    let targets: [PosterPublishTarget]
    let platforms: Set<PublishPlatform>
}
