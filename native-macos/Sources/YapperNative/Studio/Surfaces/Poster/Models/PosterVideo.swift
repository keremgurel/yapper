import Foundation

/// Where the Poster's videos come from: made in Yapper, or already posted on
/// a connected channel.
enum PosterSource: Hashable {
    case yapper
    case platform(PublishPlatform)
}

/// Anything the Poster can open. A Yapper take resolves its master through
/// its submission; a channel post carries the key Yapper kept when it
/// published it, or (Instagram) can have its file imported on demand.
struct PosterVideo: Identifiable, Equatable {
    enum Origin: Equatable {
        case yapper(submissionID: String, contentItemID: String, status: String, scheduledFor: String?, transcriptStatus: String?)
        case platform(PublishPlatform, sourceID: String, caption: String?, thumbnail: URL?, viewCount: Int, publishedAt: String, url: String, mediaKey: String?, importable: Bool)
    }

    let id: String
    var title: String
    var origin: Origin

    init(item: PosterContentItem) {
        let title = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
        id = item.id
        self.title = title.isEmpty ? "Untitled" : title
        origin = .yapper(
            submissionID: item.submissionId ?? "",
            contentItemID: item.id,
            status: item.status,
            scheduledFor: item.scheduledFor,
            transcriptStatus: item.transcriptStatus
        )
    }

    init(platform: PublishPlatform, video: PosterPlatformVideo) {
        let title = video.title.trimmingCharacters(in: .whitespacesAndNewlines)
        id = "\(platform.rawValue):\(video.id)"
        self.title = title.isEmpty ? "Untitled" : title
        origin = .platform(
            platform,
            sourceID: video.id,
            caption: video.caption,
            thumbnail: video.thumbnail.flatMap(URL.init(string:)),
            viewCount: video.viewCount,
            publishedAt: video.publishedAt,
            url: video.url,
            mediaKey: video.mediaKey,
            importable: platform == .instagram && (video.sourceFileUrl?.isEmpty == false || !video.url.isEmpty)
        )
    }

    var submissionID: String? {
        if case let .yapper(submissionID, _, _, _, _) = origin { return submissionID }
        return nil
    }

    var contentItemID: String? {
        if case let .yapper(_, contentItemID, _, _, _) = origin { return contentItemID }
        return nil
    }

    var mediaKey: String? {
        if case let .platform(_, _, _, _, _, _, _, mediaKey, _) = origin { return mediaKey }
        return nil
    }

    var platform: PublishPlatform? {
        if case let .platform(platform, _, _, _, _, _, _, _, _) = origin { return platform }
        return nil
    }

    var sourceCaption: String? {
        if case let .platform(_, _, caption, _, _, _, _, _, _) = origin { return caption }
        return nil
    }

    var transcriptStatus: String? {
        if case let .yapper(_, _, _, _, status) = origin { return status }
        return nil
    }

    /// Whether Yapper can get at the master file, now or after an import.
    var canOpen: Bool {
        switch origin {
        case .yapper: true
        case let .platform(_, _, _, _, _, _, _, mediaKey, importable): mediaKey != nil || importable
        }
    }

    /// The master behind this video, for previews, frames and publishing.
    var media: PosterMediaRef {
        PosterMediaRef(submissionID: submissionID, mediaKey: mediaKey)
    }

    /// Same-origin bytes of an Instagram post's original cover.
    var originalThumbnailPath: String? {
        guard case let .platform(platform, sourceID, _, thumbnail, _, _, _, _, _) = origin,
              platform == .instagram, thumbnail != nil,
              let encoded = sourceID.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        else { return nil }
        return "api/publish/instagram/thumbnail?mediaId=\(encoded)"
    }

    func withImportedMedia(key: String, title: String) -> PosterVideo {
        var copy = self
        if case let .platform(platform, sourceID, caption, thumbnail, views, publishedAt, url, _, importable) = origin {
            copy.origin = .platform(platform, sourceID: sourceID, caption: caption, thumbnail: thumbnail, viewCount: views, publishedAt: publishedAt, url: url, mediaKey: key, importable: importable)
        }
        if !title.isEmpty { copy.title = title }
        return copy
    }
}

/// A master video, by submission (a Yapper take) or by raw storage key.
struct PosterMediaRef: Hashable {
    var submissionID: String?
    var mediaKey: String?
}

extension PosterContentItem {
    /// Library rows that have a recorded take behind them, newest first.
    static func postable(_ items: [PosterContentItem]) -> [PosterContentItem] {
        items.filter { ($0.submissionId ?? "").isEmpty == false }
            .sorted { $0.updatedAt > $1.updatedAt }
    }
}
