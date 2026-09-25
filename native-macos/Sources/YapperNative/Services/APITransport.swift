import Foundation

/// The one path every JSON call to the Yapper API takes: a signed-in request,
/// a timing line in the perf log, reads served through `APIReadCache`, and
/// any successful write clearing that cache. The clients above it only decide
/// how a failure reads for their pages.
enum APITransport {
    /// A reply outside 2xx, with its body for the caller to read the route's
    /// own error code from.
    struct Failure: Error {
        let status: Int
        let body: Data
    }

    /// Sends `method path` and returns the body of a 2xx reply, or throws
    /// `Failure`. `prepare` sets headers and the body on the signed-in request.
    nonisolated(nonsending) static func send(
        _ path: String, method: String, prepare: @escaping @Sendable (inout URLRequest) throws -> Void = { _ in }
    ) async throws -> Data {
        let fetch: @Sendable () async throws -> Data = {
            var request = await YapperAPI.authenticatedRequest(url: StudioJSONClient.url(path))
            request.httpMethod = method
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            try prepare(&request)
            let started = ContinuousClock.now
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            PerfLog.logger.debug("http \(PerfLog.milliseconds(since: started))ms \(status) \(data.count)B \(method, privacy: .public) \(path, privacy: .public)")
            guard (200..<300).contains(status) else { throw Failure(status: status, body: data) }
            return data
        }
        guard method == "GET" else {
            let data = try await fetch()
            await APIReadCache.shared.clear()
            return data
        }
        return try await APIReadCache.shared.data(for: path, fetch: fetch)
    }
}
