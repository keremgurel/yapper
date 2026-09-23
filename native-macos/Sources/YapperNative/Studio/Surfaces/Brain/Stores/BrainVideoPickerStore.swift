import Foundation

/// Picking published videos from a connected channel and transcribing them
/// one at a time, so each has the whole request budget and the sheet can say
/// which one it is on.
@MainActor
final class BrainVideoPickerStore: ObservableObject {
    struct Failure: Identifiable, Equatable {
        let id = UUID()
        let title: String
        let code: String
    }

    static let maxPick = 8

    @Published private(set) var platform: String?
    @Published private(set) var videos: [BrainChannelVideo]?
    @Published private(set) var listError: String?
    @Published private(set) var picked: [String: BrainChannelVideo] = [:]
    @Published private(set) var pickOrder: [String] = []
    @Published private(set) var current: (index: Int, total: Int, title: String)?
    @Published private(set) var failures: [Failure] = []

    var busy: Bool { current != nil }
    var selection: [BrainChannelVideo] { pickOrder.compactMap { picked[$0] } }
    var totalCredits: Int {
        guard let platform else { return 0 }
        return selection.reduce(0) { $0 + BrainVoiceCredits.credits(platform: platform, duration: $1.durationSec) }
    }

    func show(_ platform: String) async {
        guard platform != self.platform || videos == nil else { return }
        self.platform = platform
        picked = [:]
        pickOrder = []
        videos = nil
        listError = nil
        do {
            let response: BrainChannelVideosResponse = try await StudioJSONClient.get("api/publish/\(platform)/videos")
            guard self.platform == platform else { return }
            videos = response.connected ? response.videos : []
            listError = response.connected ? nil : "This channel is not connected any more."
        } catch {
            guard self.platform == platform else { return }
            videos = []
            listError = "Your videos could not be listed right now. Try again in a moment."
        }
    }

    func toggle(_ video: BrainChannelVideo) {
        guard !BrainVoiceCredits.tooLong(video.durationSec) else { return }
        if picked[video.id] != nil {
            picked[video.id] = nil
            pickOrder.removeAll { $0 == video.id }
        } else if picked.count < Self.maxPick {
            picked[video.id] = video
            pickOrder.append(video.id)
        }
    }

    /// Transcribes the picked videos. Returns how many landed.
    func run(onSample: (BrainVoiceSample) -> Void) async -> Int {
        guard let platform, !busy, !selection.isEmpty else { return 0 }
        let videos = selection
        failures = []
        var added = 0
        for (index, video) in videos.enumerated() {
            current = (index, videos.count, video.title)
            do {
                let response: BrainVoiceSampleResponse = try await BrainLongRequest.post(
                    "api/brain/voice/samples", body: SampleRequest(platform: platform, video: video), timeout: 320
                )
                onSample(response.sample)
                added += 1
            } catch {
                let code = (error as? StudioAPIError)?.code ?? "failed"
                failures.append(Failure(title: video.title, code: code))
                // Out of credits or plan: the rest would fail the same way.
                if code == "insufficient_credits" || code == "not_entitled" { break }
            }
        }
        current = nil
        picked = [:]
        pickOrder = []
        return added
    }

    func reset() {
        picked = [:]
        pickOrder = []
        failures = []
        current = nil
    }

    private struct SampleRequest: Encodable {
        struct Video: Encodable {
            let id: String
            let url: String
            let title: String
            let thumbnail: String?
            let publishedAt: String
            let durationSec: Double?
        }

        let platform: String
        let video: Video

        init(platform: String, video: BrainChannelVideo) {
            self.platform = platform
            self.video = Video(
                id: video.id, url: video.url, title: video.title, thumbnail: video.thumbnail,
                publishedAt: video.publishedAt, durationSec: video.durationSec
            )
        }
    }
}
