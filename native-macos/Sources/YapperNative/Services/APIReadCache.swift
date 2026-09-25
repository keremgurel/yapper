import Foundation

/// Answers repeated reads of the same list from memory for a few seconds, and
/// folds identical reads made at the same moment into one request.
///
/// Every page reloads its data when it appears, which is right for freshness
/// but means switching between two tabs re-downloads the same lists over and
/// over, each a full round trip to the server. With this, going back and
/// forth costs nothing, and two stores asking for the same thing at once share
/// one request.
///
/// Only reads that are safe to serve slightly old are cached: lists and
/// settings, never anything a page polls for progress (transcription, uploads,
/// publishing status) and never a single item's detail. Any successful write
/// through the app clears everything, so an edit is never followed by a page
/// showing what was there before it.
actor APIReadCache {
    static let shared = APIReadCache()

    init() {}

    private struct Entry {
        let data: Data
        let storedAt: ContinuousClock.Instant
    }

    private var entries: [String: Entry] = [:]
    private var inFlight: [String: Task<Data, Error>] = [:]
    /// Bumped by every clear, so a read that started before a write cannot
    /// store its now-stale answer after it.
    private var generation = 0

    /// How long a path may be served from memory, or nil when it must always
    /// go to the server. Matched on the path without its query.
    static func lifetime(for path: String) -> Duration? {
        let bare = path.split(separator: "?", maxSplits: 1).first.map(String.init) ?? path
        let trimmed = bare.hasPrefix("/") ? String(bare.dropFirst()) : bare
        // Platform post lists are slow and rate limited upstream.
        if trimmed.hasPrefix("api/publish/"), trimmed.hasSuffix("/videos") { return .seconds(60) }
        return cachedLists.contains(trimmed) ? .seconds(20) : nil
    }

    private static let cachedLists: Set<String> = [
        "api/content", "api/ideas", "api/project", "api/views",
        "api/brain/blocks", "api/brain/skills", "api/brain/voice", "api/brain/catalog",
        "api/brand", "api/storage", "api/transcription-dictionary",
        "api/publish/connections", "api/publish/schedules", "api/publish/automations",
    ]

    /// The body for `path`: from memory when fresh, from a read already on
    /// its way, or from `fetch`, which is only called for cacheable paths.
    func data(for path: String, fetch: @escaping @Sendable () async throws -> Data) async throws -> Data {
        guard let lifetime = Self.lifetime(for: path) else { return try await fetch() }
        if let entry = entries[path], ContinuousClock.now - entry.storedAt < lifetime {
            return entry.data
        }
        if let running = inFlight[path] { return try await running.value }

        let startedIn = generation
        let task = Task { try await fetch() }
        inFlight[path] = task
        defer { if inFlight[path] == task { inFlight[path] = nil } }
        let data = try await task.value
        if generation == startedIn { entries[path] = Entry(data: data, storedAt: .now) }
        return data
    }

    /// Forgets everything: after a write, on sign-out, on an explicit retry.
    func clear() {
        generation += 1
        entries.removeAll()
        inFlight.removeAll()
    }
}
