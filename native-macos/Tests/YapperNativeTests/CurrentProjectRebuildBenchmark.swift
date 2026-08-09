@preconcurrency import AVFoundation
import Foundation
import Testing
@testable import YapperNative

/// Times a rebuild of whatever project is open in the installed app.
///
/// The other benchmark builds a two-clip project from one reference file, which
/// says what a rebuild costs at its best. This one says what it costs on a real
/// edit: every clip, every cutaway, every audio layer the creator actually has.
/// That number is what a framing change waits on before the picture catches up,
/// so it is the one worth knowing.
///
/// Off unless asked for, and it reads a file the test machine may not have.
private let currentProjectURL = FileManager.default
    .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    .appending(path: "Yapper Studio Native", directoryHint: .isDirectory)
    .appending(path: "CurrentProject.json", directoryHint: .notDirectory)

@Suite(.serialized)
struct CurrentProjectRebuildBenchmark {
    @Test(
        "Rebuild cost for the open project",
        .enabled(if: ProcessInfo.processInfo.environment["YAPPER_BENCH"] == "1"
            && FileManager.default.fileExists(atPath: currentProjectURL.path))
    )
    func rebuildCost() async throws {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let project = try decoder.decode(
            EditorProject.self,
            from: Data(contentsOf: currentProjectURL)
        )
        print("""
        project: \(project.clips.count) clips, \
        \(project.duration.rounded()) s, \
        \(project.overlays?.count ?? 0) overlays, \
        \(project.audioLayers?.count ?? 0) audio layers, \
        \(project.captionEntries.count) captions
        """)

        CompositionSourceCache.shared.keepOnly([])
        let cold = try await time {
            _ = try await CompositionBuilder.build(project: project, for: .export)
        }

        // The two purposes, warm, side by side. The gap between them is the
        // Core Animation pass the player cannot use and used to wait for.
        var export: [Double] = []
        var preview: [Double] = []
        for _ in 0 ..< 3 {
            export.append(try await time {
                _ = try await CompositionBuilder.build(project: project, for: .export)
            })
            preview.append(try await time {
                _ = try await CompositionBuilder.build(project: project, for: .preview)
            })
        }

        // What the editor also waits on before it swaps the item in.
        let built = try await CompositionBuilder.build(project: project, for: .preview)
        let load = try await time { _ = try await built.playerItem.asset.load(.isPlayable) }

        print(String(
            format: "rebuild: cold %.1f ms, export %.1f ms, preview %.1f ms, isPlayable %.1f ms",
            cold * 1000,
            export.reduce(0, +) / Double(export.count) * 1000,
            preview.reduce(0, +) / Double(preview.count) * 1000,
            load * 1000
        ))
        #expect(cold > 0)
    }

    private func time(_ work: () async throws -> Void) async rethrows -> Double {
        let start = ContinuousClock.now
        try await work()
        return Double(ContinuousClock.now.duration(to: start).components.attoseconds) / -1e18
    }
}
