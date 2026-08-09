import Foundation

/// Where the creator's spellings live.
///
/// They belong to the account, so the same words are corrected in the browser
/// and here. When nobody is signed in — or the machine is offline — they are
/// kept in a file beside the project instead, and the account copy takes over
/// again the next time it answers.
actor DictionaryStore {
    static let shared = DictionaryStore()

    private struct EntriesResponse: Decodable {
        struct Entry: Decodable {
            let id: String
            let term: String
            let aliases: [String]?
        }

        let entries: [Entry]?
        let entry: Entry?
    }

    private let fileURL: URL = {
        let directory = FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appending(path: "YapperNative", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appending(path: "transcription-dictionary.json")
    }()

    /// Everything saved, account first and local only as a fallback.
    func entries() async -> [DictionaryEntry] {
        if let remote = try? await request(path: "api/transcription-dictionary", method: "GET") {
            saveLocal(remote)
            return remote
        }
        return loadLocal()
    }

    /// Adds a spelling, or replaces the aliases of one already saved.
    @discardableResult
    func save(term: String, aliases: [String]) async throws -> [DictionaryEntry] {
        let term = TranscriptionDictionary.cleanValue(term)
        guard !TranscriptionDictionary.key(term).isEmpty else {
            throw NativeEditorError.aiFailed("A spelling needs at least one letter or number.")
        }
        let body = try JSONSerialization.data(
            withJSONObject: ["term": term, "aliases": TranscriptionDictionary.cleanAliases(aliases)]
        )
        if (try? await request(path: "api/transcription-dictionary", method: "POST", body: body)) != nil {
            return await entries()
        }
        // Offline, or signed out: keep it on this machine.
        var local = loadLocal()
        if let index = local.firstIndex(where: {
            TranscriptionDictionary.key($0.term) == TranscriptionDictionary.key(term)
        }) {
            local[index].aliases = TranscriptionDictionary.cleanAliases(aliases)
        } else {
            guard local.count < TranscriptionDictionary.maximumEntries else {
                throw NativeEditorError.aiFailed("The dictionary is full.")
            }
            local.append(DictionaryEntry(term: term, aliases: aliases))
        }
        saveLocal(local)
        return local
    }

    @discardableResult
    func update(id: String, term: String, aliases: [String]) async -> [DictionaryEntry] {
        let body = try? JSONSerialization.data(
            withJSONObject: [
                "term": TranscriptionDictionary.cleanValue(term),
                "aliases": TranscriptionDictionary.cleanAliases(aliases),
            ]
        )
        if
            !id.hasPrefix("local-"),
            (try? await request(
                path: "api/transcription-dictionary/\(id)",
                method: "PATCH",
                body: body
            )) != nil
        {
            return await entries()
        }
        var local = loadLocal()
        if let index = local.firstIndex(where: { $0.id == id }) {
            local[index].term = TranscriptionDictionary.cleanValue(term)
            local[index].aliases = TranscriptionDictionary.cleanAliases(aliases)
        }
        saveLocal(local)
        return local
    }

    @discardableResult
    func remove(id: String) async -> [DictionaryEntry] {
        if
            !id.hasPrefix("local-"),
            (try? await request(
                path: "api/transcription-dictionary/\(id)",
                method: "DELETE"
            )) != nil
        {
            return await entries()
        }
        let local = loadLocal().filter { $0.id != id }
        saveLocal(local)
        return local
    }

    // MARK: - The account's copy

    @discardableResult
    private func request(
        path: String,
        method: String,
        body: Data? = nil
    ) async throws -> [DictionaryEntry] {
        var request = await YapperAPI.authenticatedRequest(url: YapperAPI.url(path: path))
        request.httpMethod = method
        request.timeoutInterval = 20
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard
            let http = response as? HTTPURLResponse,
            (200 ..< 300).contains(http.statusCode)
        else {
            throw YapperAPI.failure(
                status: (response as? HTTPURLResponse)?.statusCode ?? 0,
                body: data,
                action: "Saving the dictionary"
            )
        }
        let decoded = try? JSONDecoder().decode(EntriesResponse.self, from: data)
        let raw = decoded?.entries ?? decoded?.entry.map { [$0] } ?? []
        return raw.map {
            DictionaryEntry(id: $0.id, term: $0.term, aliases: $0.aliases ?? [])
        }
    }

    // MARK: - This machine's copy

    private func loadLocal() -> [DictionaryEntry] {
        guard
            let data = try? Data(contentsOf: fileURL),
            let entries = try? JSONDecoder().decode([DictionaryEntry].self, from: data)
        else { return [] }
        return Array(entries.prefix(TranscriptionDictionary.maximumEntries))
    }

    private func saveLocal(_ entries: [DictionaryEntry]) {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }
}
