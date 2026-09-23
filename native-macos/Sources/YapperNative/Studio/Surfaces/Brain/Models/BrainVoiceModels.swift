import Foundation

/// One of the creator's own videos the Brain has listened to.
struct BrainVoiceSample: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let platform: String
    let externalPostId: String
    let url: String
    let title: String
    let thumbnail: String?
    let publishedAt: String?
    let durationSec: Double?
    let transcript: String
    let creditsCharged: Int
    let createdAt: String
}

struct BrainVoiceSamplesResponse: Codable, Sendable { let samples: [BrainVoiceSample]? }
struct BrainVoiceSampleResponse: Codable, Sendable {
    let sample: BrainVoiceSample
    let charged: Int
}

/// One published video on a connected channel, from `/api/publish/<platform>/videos`.
struct BrainChannelVideo: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let title: String
    let thumbnail: String?
    let publishedAt: String
    let url: String
    let durationSec: Double?
}

struct BrainChannelVideosResponse: Codable, Sendable {
    let connected: Bool
    let videos: [BrainChannelVideo]
}

/// What a voice sample costs: one credit per three minutes, at most eight,
/// and nothing for YouTube, whose captions are read instead.
enum BrainVoiceCredits {
    static let secondsPerUnit = 180.0
    static let maxUnits = 8

    static func units(_ duration: Double?) -> Int {
        guard let duration, duration.isFinite, duration > 0 else { return 1 }
        return min(maxUnits, max(1, Int((duration / secondsPerUnit).rounded(.up))))
    }

    static func credits(platform: String, duration: Double?) -> Int {
        platform == "youtube" ? 0 : units(duration)
    }

    static func tooLong(_ duration: Double?) -> Bool {
        guard let duration else { return false }
        return duration > secondsPerUnit * Double(maxUnits)
    }

    static func costLabel(platform: String, duration: Double?) -> String {
        let credits = credits(platform: platform, duration: duration)
        if credits == 0 { return "Free, from captions" }
        if duration == nil { return "1 credit per 3 min" }
        return credits == 1 ? "1 credit" : "\(credits) credits"
    }
}

enum BrainVoiceFormat {
    static func platformLabel(_ platform: String) -> String {
        PublishPlatform(rawValue: platform)?.label ?? platform.capitalized
    }

    static func duration(_ seconds: Double?) -> String {
        guard let seconds, seconds.isFinite, seconds > 0 else { return "" }
        let whole = Int(seconds.rounded())
        return String(format: "%d:%02d", whole / 60, whole % 60)
    }

    static func date(_ iso: String?) -> String {
        guard let iso else { return "" }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        return date?.formatted(.dateTime.month(.abbreviated).day().year()) ?? ""
    }

    /// What to tell the creator when one video could not be heard.
    static func failure(_ code: String) -> String {
        switch code {
        case "no_captions": "YouTube has no captions for this video yet. Try again once they appear."
        case "no_source_file": "The platform would not hand over the video file, so it could not be transcribed."
        case "empty_transcript": "Nothing was heard in this video. Music-only clips cannot teach a voice."
        case "too_long": "This video is longer than 24 minutes. Pick a shorter one."
        case "insufficient_credits": "Not enough credits for this video."
        case "not_entitled": "Voice samples need an active plan."
        case "rate_limited": "Too many videos at once. Wait a moment and try again."
        default: "This video could not be transcribed. Try again in a moment."
        }
    }
}
