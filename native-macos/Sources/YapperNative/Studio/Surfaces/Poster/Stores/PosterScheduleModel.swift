import Foundation

/// Saving the prepared posts to send later. The request key is kept, so a
/// second press replays the same schedule instead of creating another,
/// unless the server said nothing was saved and the creator has to change
/// something first.
@MainActor
final class PosterScheduleModel: ObservableObject {
    /// Post now or schedule: the one publish button does whichever is chosen.
    @Published var later = false
    @Published private(set) var enabled: Bool?
    @Published private(set) var loadFailed = false
    @Published var when = PosterQuickTimes.options(from: Date()).first?.date ?? Date().addingTimeInterval(24 * 60 * 60)
    @Published private(set) var saving = false
    @Published private(set) var saved = false
    @Published private(set) var error: String?
    private var requestKey: String?

    let timezone = TimeZone.current.identifier

    func load() async {
        do {
            let schedules: PosterSchedules = try await PosterHTTP.get("api/publish/schedules")
            enabled = schedules.enabled
            loadFailed = false
        } catch {
            loadFailed = true
        }
    }

    func schedule(
        _ targets: [PosterPublishTarget],
        to platforms: [PublishPlatform],
        youtube: PosterYouTubeSettings,
        tiktok: PosterTikTokReview?,
        connections: PosterConnectionStore
    ) async -> Bool {
        let count = targets.count * platforms.count
        guard !saving, !saved, enabled == true, count > 0, count <= 20 else { return false }
        guard when.timeIntervalSinceNow >= 60 else {
            error = PosterErrorCopy.schedule("invalid_body")
            return false
        }
        saving = true
        error = nil
        defer { saving = false }
        let key = requestKey ?? UUID().uuidString.lowercased()
        requestKey = key
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let entries: [[String: Any]] = targets.flatMap { target in
            platforms.map { platform in
                [
                    "platform": platform.rawValue,
                    "expectedAccountId": connections.accountID(for: platform) ?? "",
                    "input": Dictionary.compact(Self.input(target, platform, youtube: youtube, tiktok: tiktok)),
                ] as [String: Any]
            }
        }
        do {
            let _: PosterScheduleCreated = try await PosterHTTP.post("api/publish/schedules", body: [
                "requestKey": key,
                "scheduledFor": formatter.string(from: when),
                "timezone": timezone,
                "targets": entries,
            ])
            saved = true
            return true
        } catch let failure as PosterHTTPError {
            if Self.notSaved(failure.code) { requestKey = nil }
            error = PosterErrorCopy.schedule(failure.code)
        } catch {
            self.error = PosterErrorCopy.schedule(nil)
        }
        return false
    }

    /// Codes for a schedule the server refused outright. The next press is a
    /// new request, so the corrected posts are not compared with the refused
    /// ones. Same set as the web's `use-schedule-submit`.
    static func notSaved(_ code: String?) -> Bool {
        guard let code else { return false }
        return code.hasPrefix("tiktok_") || [
            "invalid_body", "destination_not_connected", "destination_account_changed", "thumbnail_unavailable",
            "media_unavailable", "media_not_found", "content_item_unavailable", "duplicate_destination", "too_many_scheduled",
        ].contains(code)
    }

    /// What one destination sends when its time comes: the same copy, cover
    /// and settings a post now would. TikTok carries its reviewed Direct Post
    /// caption and settings, or nothing extra for an inbox draft.
    static func input(_ target: PosterPublishTarget, _ platform: PublishPlatform, youtube: PosterYouTubeSettings,
                      tiktok: PosterTikTokReview?) -> [String: Any?] {
        var input = target.sourceBody
        input["thumbnailKey"] = target.thumbnailKey
        let copy = target.copy(for: platform)
        switch platform {
        case .youtube:
            input["title"] = copy.title
            input["description"] = copy.body
            input.merge(youtube.body) { _, chosen in chosen }
        case .instagram, .facebook:
            input["caption"] = copy.body.isEmpty ? copy.title : copy.body
        case .tiktok:
            if let tiktok, tiktok.mode == .direct {
                input["caption"] = tiktok.caption
                input["settings"] = PosterPublishAPI.settingsBody(tiktok.settings)
            }
        }
        return input
    }
}
