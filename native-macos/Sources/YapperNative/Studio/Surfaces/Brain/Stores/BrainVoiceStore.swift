import Foundation

/// The videos the Brain has listened to, and rewriting the voice from them.
@MainActor
final class BrainVoiceStore: ObservableObject {
    static let shared = BrainVoiceStore()

    @Published private(set) var samples: [BrainVoiceSample]?
    @Published private(set) var failed = false
    @Published private(set) var deriving = false
    @Published private(set) var deriveError: String?
    @Published private(set) var removeError = false

    var loading: Bool { samples == nil && !failed }
    var count: Int { samples?.count ?? 0 }

    func refresh() async {
        do {
            let response: BrainVoiceSamplesResponse = try await StudioJSONClient.get("api/brain/voice")
            samples = response.samples ?? []
            failed = false
        } catch {
            if samples == nil { failed = true }
        }
    }

    func remove(_ id: String) async {
        removeError = false
        let previous = samples
        samples?.removeAll { $0.id == id }
        do {
            try await StudioJSONClient.delete("api/brain/voice/samples/\(id)")
            BrainPreviewStore.shared.invalidate()
        } catch {
            samples = previous
            removeError = true
        }
    }

    func add(_ sample: BrainVoiceSample) {
        samples = [sample] + (samples ?? []).filter { $0.id != sample.id }
    }

    /// Rewrites how you sound and how your scripts are built from every
    /// sample, then reloads the Essentials that changed on the server.
    func derive() async {
        guard !deriving else { return }
        deriving = true
        deriveError = nil
        defer { deriving = false }
        do {
            _ = try await BrainLongRequest.post("api/brain/voice/derive", body: [String: String](), timeout: 90, as: BrainJSONValue.self)
            await BrainProjectStore.shared.refresh(force: true)
            BrainPreviewStore.shared.invalidate()
        } catch let error as StudioAPIError where error.code == "no_samples" {
            deriveError = "Add at least one video first."
        } catch {
            deriveError = "The voice profile could not be written. Your videos are kept; try rebuilding in a moment."
        }
    }
}
