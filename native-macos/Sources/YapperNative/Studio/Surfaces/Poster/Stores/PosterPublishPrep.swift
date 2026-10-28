import Foundation

/// Turns the open video into what the publish button posts: the cover is
/// rendered and uploaded here, and the video carries its captions per
/// platform. A cover that fails to upload never blocks the post.
@MainActor
final class PosterPublishPrep: ObservableObject {
    static let shared = PosterPublishPrep()

    @Published private(set) var preparing = false
    @Published private(set) var warning: String?

    /// The prepared target, or nil when the video could not be prepared and
    /// `warning` says why.
    func prepare(_ video: PosterVideo, cover: PosterCoverDraft, captions: PosterCaptionSet, destinations: Set<PublishPlatform>) async -> PosterPublishTarget? {
        guard !preparing else { return nil }
        preparing = true
        warning = nil
        defer { preparing = false }
        let needsCover = cover.image != nil && destinations.contains(where: { $0 != .tiktok })
        async let uploadedCover = uploadCover(cover, needed: needsCover)
        var submissionID = video.submissionID
        var contentItemID = video.contentItemID
        if case let .project(listing) = video.origin {
            do {
                let saved = try await PosterProjectSync.shared.prepare(listing)
                submissionID = saved.submissionId
                contentItemID = saved.id
            } catch {
                warning = error.localizedDescription
                return nil
            }
        }
        let thumbnailKey = await uploadedCover
        if needsCover && thumbnailKey == nil { warning = "The cover couldn't upload. The video is still ready to publish." }
        let headline = cover.headline.trimmingCharacters(in: .whitespacesAndNewlines)
        return PosterPublishTarget(
            id: video.id,
            title: video.title,
            fallbackTitle: headline.isEmpty ? video.title : headline,
            captions: captions,
            submissionID: submissionID,
            mediaKey: video.mediaKey,
            contentItemID: contentItemID,
            thumbnailKey: thumbnailKey
        )
    }

    private func uploadCover(_ cover: PosterCoverDraft, needed: Bool) async -> String? {
        guard needed, let jpeg = PosterCoverRenderer.jpeg(cover) else { return nil }
        return try? await PosterFileUpload.uploadCover(jpeg: jpeg)
    }
}
