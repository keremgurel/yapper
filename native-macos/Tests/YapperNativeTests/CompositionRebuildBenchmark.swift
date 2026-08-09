@preconcurrency import AVFoundation
import Foundation
import Testing
@testable import YapperNative

/// Times the rebuild that runs after every timeline edit. Not an assertion of
/// speed, which would be a flaky thing to check on a shared machine, but a way
/// to see the cost of an edit on real footage.
private let referenceURL = URL(
    filePath: "/Volumes/G MicroSD/DCIM/DJI_001/DJI_20260801210742_0340_D.MP4"
)

@Suite(.serialized)
struct CompositionRebuildBenchmark {
    @Test(
        "Rebuild cost per edit",
        .enabled(if: ProcessInfo.processInfo.environment["YAPPER_BENCH"] == "1"
            && FileManager.default.fileExists(atPath: referenceURL.path))
    )
    func rebuildCost() async throws {
        let media = try await MediaProbe.inspect(url: referenceURL)
        let project = EditorProject(
            name: "Rebuild benchmark",
            media: [media],
            clips: [
                TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 4),
                TimelineClip(mediaID: media.id, sourceStart: 6, sourceEnd: 9),
            ]
        )

        CompositionSourceCache.shared.keepOnly([])
        let cold = try await time { _ = try await CompositionBuilder.build(project: project) }

        var warm: [Double] = []
        for _ in 0 ..< 5 {
            warm.append(try await time { _ = try await CompositionBuilder.build(project: project) })
        }
        let average = warm.reduce(0, +) / Double(warm.count)

        print(String(
            format: "rebuild: cold %.1f ms, warm %.1f ms (min %.1f, max %.1f)",
            cold * 1000,
            average * 1000,
            (warm.min() ?? 0) * 1000,
            (warm.max() ?? 0) * 1000
        ))
        #expect(cold > 0)
    }

    private func time(_ work: () async throws -> Void) async rethrows -> Double {
        let start = ContinuousClock.now
        try await work()
        return Double(ContinuousClock.now.duration(to: start).components.attoseconds) / -1e18
    }
}
