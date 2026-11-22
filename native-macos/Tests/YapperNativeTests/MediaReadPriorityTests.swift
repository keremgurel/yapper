import Foundation
import Testing
@testable import YapperNative

struct MediaReadPriorityTests {
    @Test func copyWaitsForAllAudioReadsAndResumesAfterFailure() async throws {
        let gate = MediaReadPriority()
        let file = FileManager.default.temporaryDirectory
        let volume = MediaReadPriority.volume(containing: file)
        enum DecodeFailure: Error { case cancelled }
        do {
            try await gate.withAudioRead(from: file) {
                await gate.withAudioRead(from: file) {}
                try await gate.waitToCopy(on: URL(fileURLWithPath: "/other-volume"))
                let waiting = Task { try await gate.waitToCopy(on: volume) }
                try await Task.sleep(for: .milliseconds(100))
                waiting.cancel()
                await #expect(throws: CancellationError.self) { try await waiting.value }
                throw DecodeFailure.cancelled
            }
        } catch DecodeFailure.cancelled {}
        try await gate.waitToCopy(on: volume)
    }
}
