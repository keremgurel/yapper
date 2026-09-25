import Foundation
import Testing
@testable import YapperNative

struct APIReadCacheTests {
    final class Counter: @unchecked Sendable {
        private let lock = NSLock()
        private var value = 0
        func next() -> Int { lock.lock(); defer { lock.unlock() }; value += 1; return value }
        var count: Int { lock.lock(); defer { lock.unlock() }; return value }
    }

    @Test func onlyReadMostlyListsAreCached() {
        #expect(APIReadCache.lifetime(for: "api/content") == .seconds(20))
        #expect(APIReadCache.lifetime(for: "api/content?surface=poster") == .seconds(20))
        #expect(APIReadCache.lifetime(for: "/api/project") == .seconds(20))
        #expect(APIReadCache.lifetime(for: "api/publish/instagram/videos") == .seconds(60))
        // Detail, progress and media are never served from memory.
        #expect(APIReadCache.lifetime(for: "api/content/abc") == nil)
        #expect(APIReadCache.lifetime(for: "api/transcribe/status") == nil)
        #expect(APIReadCache.lifetime(for: "api/media/sign?key=x") == nil)
        #expect(APIReadCache.lifetime(for: "api/publish/youtube") == nil)
    }

    @Test func repeatedAndSimultaneousReadsShareOneRequest() async throws {
        let cache = APIReadCache()
        let calls = Counter()
        let fetch: @Sendable () async throws -> Data = {
            _ = calls.next()
            try await Task.sleep(for: .milliseconds(50))
            return Data("ok".utf8)
        }
        async let first = cache.data(for: "api/ideas", fetch: fetch)
        async let second = cache.data(for: "api/ideas", fetch: fetch)
        _ = try await (first, second)
        _ = try await cache.data(for: "api/ideas", fetch: fetch)
        #expect(calls.count == 1)
    }

    @Test func aWriteClearsWhatWasRead() async throws {
        let cache = APIReadCache()
        let calls = Counter()
        let fetch: @Sendable () async throws -> Data = { Data("\(calls.next())".utf8) }
        let before = try await cache.data(for: "api/content", fetch: fetch)
        await cache.clear()
        let after = try await cache.data(for: "api/content", fetch: fetch)
        #expect(before != after)
        #expect(calls.count == 2)
    }

    @Test func failuresAreNotRemembered() async throws {
        struct Boom: Error {}
        let cache = APIReadCache()
        let calls = Counter()
        let failing: @Sendable () async throws -> Data = { _ = calls.next(); throw Boom() }
        _ = try? await cache.data(for: "api/brand", fetch: failing)
        _ = try? await cache.data(for: "api/brand", fetch: failing)
        #expect(calls.count == 2)
    }

    @Test func uncachedPathsAlwaysFetch() async throws {
        let cache = APIReadCache()
        let calls = Counter()
        let fetch: @Sendable () async throws -> Data = { _ = calls.next(); return Data() }
        _ = try await cache.data(for: "api/content/abc", fetch: fetch)
        _ = try await cache.data(for: "api/content/abc", fetch: fetch)
        #expect(calls.count == 2)
    }
}
