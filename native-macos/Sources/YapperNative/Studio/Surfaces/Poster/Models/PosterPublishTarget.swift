import Foundation

/// One prepared video, as the publish sheet posts it: its master, its cover
/// key, and the captions written per platform in the Poster.
struct PosterPublishTarget: Identifiable, Equatable {
    let id: String
    let title: String
    /// The cover headline, used as a title when nothing else was written.
    let fallbackTitle: String
    let captions: PosterCaptionSet
    let submissionID: String?
    let mediaKey: String?
    let contentItemID: String?
    let thumbnailKey: String?

    /// What actually goes out on one platform. Same rule as `outgoingCopy`.
    func copy(for platform: PublishPlatform) -> (title: String, body: String) {
        let prepared = captions[platform]
        let preparedTitle = prepared?.title.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let title = preparedTitle.isEmpty ? fallbackTitle : preparedTitle
        return (title, prepared?.rendered ?? "")
    }

    /// The source fields every publish route takes.
    var sourceBody: [String: Any?] {
        ["submissionId": submissionID, "mediaKey": mediaKey, "contentItemId": contentItemID]
    }
}
