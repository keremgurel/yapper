import Foundation

/// The idea's other versions, by format, and the one call that writes a new
/// one. A version written here appears as a tab straight away.
@MainActor
final class IdeaCanvasVersionsStore: ObservableObject {
    @Published private(set) var stores: [IdeaCanvasVersionFormat: IdeaCanvasVersionStore] = [:]
    /// The format being written right now, for the shimmer.
    @Published private(set) var writing: IdeaCanvasVersionFormat?
    @Published private(set) var error: String?

    private let itemID: String

    init(itemID: String) { self.itemID = itemID }

    /// Fills in versions the server has that this session hasn't opened yet.
    /// Ones already open keep their unsaved edits.
    func load(_ versions: [IdeaCanvasVersion]) {
        for version in versions where stores[version.format] == nil {
            stores[version.format] = IdeaCanvasVersionStore(itemID: itemID, version: version)
        }
    }

    func write(_ format: IdeaCanvasVersionFormat, from source: IdeaCanvasVersionFormat) async {
        guard writing == nil else { return }
        writing = format
        error = nil
        defer { writing = nil }
        do {
            let envelope = try await requestWrite(format, from: source)
            stores[format] = IdeaCanvasVersionStore(itemID: itemID, version: envelope.version)
            NotificationCenter.default.post(name: .ideaCanvasDidSave, object: itemID)
        } catch let failure as StudioAPIError where failure.code == "insufficient_credits" {
            error = "You're out of credits for this month."
        } catch {
            self.error = "The \(format.noun) couldn't be written. Nothing was charged; try again."
        }
    }

    /// Writing a long-form takes around half a minute, past what the shared
    /// client's default timeout is comfortable with, so this call sets its own.
    private func requestWrite(
        _ format: IdeaCanvasVersionFormat, from source: IdeaCanvasVersionFormat
    ) async throws -> IdeaCanvasVersionEnvelope {
        let path = "api/content/\(itemID)/versions/\(format.rawValue)/write"
        let payload = try StudioJSONClient.encoder.encode(["from": source.rawValue])
        do {
            let data = try await APITransport.send(path, method: "POST") { request in
                request.timeoutInterval = 150
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = payload
            }
            return try StudioJSONClient.decoder.decode(IdeaCanvasVersionEnvelope.self, from: data)
        } catch let failure as APITransport.Failure {
            throw StudioJSONClient.failure(status: failure.status, body: failure.body)
        }
    }

    /// Removes a written version for good. Unsaved edits to it go with it.
    func delete(_ format: IdeaCanvasVersionFormat) async {
        error = nil
        do {
            try await StudioJSONClient.delete("api/content/\(itemID)/versions/\(format.rawValue)")
            stores[format] = nil
            NotificationCenter.default.post(name: .ideaCanvasDidSave, object: itemID)
        } catch {
            self.error = "The \(format.noun) couldn't be deleted. Try again."
        }
    }

    func flushAll() async throws {
        for store in stores.values { try await store.autosave.flush() }
    }
}
