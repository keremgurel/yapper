@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor LengthStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

/// Answers with whatever placements the test hands it.
private actor FixedPlanner: OverlayPlacementPlanning {
    let placements: [OverlayPlacement]
    init(_ placements: [OverlayPlacement]) { self.placements = placements }
    func plan(instruction: String, words: [String], files: [OverlayPlacementService.File],
              frameAspect: Double, speaker: [SpeakerSample], placed: [OverlayPlacementService.Placed]) async throws -> OverlayPlacementService.Plan {
        .init(placements: placements, sounds: [], texts: [])
    }
}

/// The placement workflow against the media's own length: "for its full
/// length", "starting N seconds into its clip", and never past the last frame.
@MainActor
@Suite(.serialized)
struct PlacementLengthTests {
    @Test func lengthsOffsetsAndMissesFollowTheRequest() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "placement-length-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        func video(_ name: String, _ seconds: Double) async throws -> URL {
            let url = root.appending(path: "\(name).mov")
            try await SyntheticVideo.write(color: NSColor.blue.cgColor, size: CGSize(width: 160, height: 90), seconds: seconds, to: url)
            return url
        }
        let mainURL = try await video("main", 12)
        let full = try await MediaProbe.inspect(url: try await video("freeze", 4))
        let short = try await MediaProbe.inspect(url: try await video("browser", 1))
        let lost = try await MediaProbe.inspect(url: try await video("live", 3))
        let planner = FixedPlanner([
            // Quoted over 1.2 s of speech, but asked for its full length from
            // 0.5 s in: 3.5 s.
            .init(file: full.name, quote: "students freeze", reason: nil, fullLength: true, sourceStart: 0.5),
            // A 1 s clip quoted over 2.4 s of speech stops at its last frame.
            .init(file: short.name, quote: "the browser opens on the site", reason: nil),
            // Words the speaker never said.
            .init(file: lost.name, quote: "a sentence nobody said aloud", reason: nil),
        ])
        let session = EditorSession(store: LengthStore(), overlayPlacementService: planner)
        defer { session.player.replaceCurrentItem(with: nil) }
        await session.importMedia([mainURL])
        let main = try #require(session.project.media.first)
        session.updateProject { project in
            project.media += [full, short, lost]
            let spoken = "so students freeze and then the browser opens on the site right away".split(separator: " ")
            project.transcript = spoken.enumerated().map { index, text in
                TranscriptWord(mediaID: main.id, text: String(text), start: 1 + Double(index) * 0.6, end: 1.5 + Double(index) * 0.6)
            }
        }

        let result = await session.performAppAction(OverlayWorkflowInput(
            instruction: "place these", mode: .placeImported, mediaIDs: [full.id, short.id, lost.id]))

        #expect(result.status == .applied)
        let byMedia = Dictionary(uniqueKeysWithValues: (session.project.overlays ?? []).map { ($0.mediaID, $0) })
        let placedFull = try #require(byMedia[full.id])
        #expect(abs(placedFull.sourceStart - 0.5) < 1e-6)
        #expect(abs(placedFull.duration - (full.duration - 0.5)) < 0.05)
        let placedShort = try #require(byMedia[short.id])
        #expect(placedShort.duration <= short.duration + 1e-6)
        #expect(byMedia[lost.id] == nil)
        // The one that did not land is named, with why, where Chirpy reads it.
        #expect(result.message.contains("Not placed: \(lost.name)"))
        #expect(result.message.contains("not found in the kept speech"))
    }
}
