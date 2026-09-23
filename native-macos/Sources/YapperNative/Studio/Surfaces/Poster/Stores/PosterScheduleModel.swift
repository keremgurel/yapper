import Foundation

/// Saving the prepared posts to send later. The request key is kept, so a
/// second press replays the same schedule instead of creating another.
@MainActor
final class PosterScheduleModel: ObservableObject {
    @Published var open = false
    @Published private(set) var enabled: Bool?
    @Published private(set) var loadFailed = false
    @Published var when = Date().addingTimeInterval(24 * 60 * 60)
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
                    "input": Dictionary.compact(Self.input(target, platform)),
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
            error = PosterErrorCopy.schedule(failure.code)
        } catch {
            self.error = PosterErrorCopy.schedule(nil)
        }
        return false
    }

    private static func input(_ target: PosterPublishTarget, _ platform: PublishPlatform) -> [String: Any?] {
        var input = target.sourceBody
        input["thumbnailKey"] = target.thumbnailKey
        let copy = target.copy(for: platform)
        switch platform {
        case .youtube:
            input["title"] = copy.title
            input["description"] = copy.body
            input["privacyStatus"] = "public"
        case .instagram, .facebook:
            input["caption"] = copy.body.isEmpty ? copy.title : copy.body
        case .tiktok:
            break
        }
        return input
    }
}
