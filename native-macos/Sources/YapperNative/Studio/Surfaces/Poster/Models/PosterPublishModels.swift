import Foundation

/// What every publish route resolves to. `url` when the post is live and
/// linkable; `draft` when it landed in the platform's inbox to finish there.
struct PosterPublishResult: Codable, Equatable {
    let jobId: String
    let url: String?
    let draft: Bool?
}

/// What happened on one platform for one video.
struct PosterOutcome: Equatable, Identifiable {
    enum Status: Equatable { case posted, draft, pending, failed, scheduled }

    let videoID: String
    let videoTitle: String
    let platform: PublishPlatform
    let status: Status
    var url: URL?
    var error: String?

    var id: String { "\(videoID):\(platform.rawValue)" }

    var label: String {
        switch status {
        case .posted: "Posted"
        case .draft: "Delivered to TikTok inbox"
        case .pending: "Awaiting confirmation"
        case .failed: "Failed"
        case .scheduled: "Scheduled"
        }
    }

    /// One line for the destination card once the job has left the app.
    var summary: String {
        switch status {
        case .posted: "Posted to \(platform.label)."
        case .draft: "In your TikTok inbox. Open TikTok to finish posting."
        case .pending: PosterErrorCopy.publish("publish_in_progress")
        case .failed: PosterErrorCopy.publish(error ?? "post_failed")
        case .scheduled: "Scheduled. Change it in Calendar."
        }
    }
}

/// `/api/publish/preview`: a playable URL and the master's length.
struct PosterVideoPreview: Codable, Equatable {
    let url: String
    let duration: Double
    let width: Double?
    let height: Double?
}

struct PosterTikTokCreator: Codable, Equatable {
    let creator_nickname: String
    let creator_username: String
    let creator_avatar_url: String?
    let privacy_level_options: [String]
    let comment_disabled: Bool
    let duet_disabled: Bool
    let stitch_disabled: Bool
    let max_video_post_duration_sec: Double
}

struct PosterTikTokContext: Codable, Equatable {
    let creator: PosterTikTokCreator
    let accountId: String
    let audited: Bool
}

struct PosterScheduleSummary: Codable, Equatable {
    let id: String
    let platform: String
    let scheduledFor: String
    let status: String
}

struct PosterSchedules: Codable, Equatable {
    let enabled: Bool
    let schedules: [PosterScheduleSummary]
}

struct PosterScheduleCreated: Codable, Equatable {
    let schedules: [PosterScheduleSummary]
}

struct PosterImportedMedia: Codable, Equatable {
    let mediaKey: String
    let title: String
}

struct PosterUploadTicket: Codable, Equatable {
    let url: String
    let key: String
}

struct PosterSubmissionEnvelope: Codable, Equatable {
    struct Submission: Codable, Equatable {
        let id: String
        let mediaKey: String?
    }
    let submission: Submission
}

struct PosterSignedURL: Codable, Equatable {
    let url: String
}

struct PosterTranscript: Codable, Equatable {
    struct Word: Codable, Equatable { let text: String? }
    let words: [Word]

    var text: String {
        words.compactMap(\.text).joined(separator: " ")
            .split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}

struct PosterGeneratedThumbnail: Codable, Equatable {
    let image: String
}
