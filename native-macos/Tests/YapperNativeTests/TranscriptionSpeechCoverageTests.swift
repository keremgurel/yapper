import Foundation
import Testing
@testable import YapperNative

struct TranscriptionSpeechCoverageTests {
    @Test("the source recording's omitted takes are independently detected as speech")
    func referenceCoverage() throws {
        guard let path = ProcessInfo.processInfo.environment["EP12_COVERAGE_MEDIA"] else { return }
        let ranges = try TranscriptionSpeechCoverage.measure(url: URL(filePath: path))
        for time in [120.3, 121.0, 258.5, 261.5, 555.3] {
            #expect(ranges.contains { $0[0] <= time && time <= $0[1] })
        }
        // The earlier energy-only audit flagged this outdoor noise as a gap.
        #expect(!ranges.contains { $0[0] <= 423 && 423 <= $0[1] })
        print("Independent speech coverage: \(ranges.count) source regions")
    }
}
