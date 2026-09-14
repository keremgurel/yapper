import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor CreationRoutingStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

private actor UnexpectedPlacementPlanner: OverlayPlacementPlanning {
    func plan(instruction: String, words: [String], files: [OverlayPlacementService.File],
              frameAspect: Double, speaker: [SpeakerSample], placed: [OverlayPlacementService.Placed]) async throws -> OverlayPlacementService.Plan {
        Issue.record("A creation request reached the existing-media placement service: \(instruction)")
        return .init(placements: [], sounds: [], texts: [])
    }
}

@MainActor
@Suite(.serialized)
struct OverlayCreationRoutingTests {
    @Test(arguments: ["make some overlays", "make some more overlays",
                      "make a couple of new overlays", "create new overlays like @Existing card"])
    func chatCreatesNewAssetsWhenOverlaysAlreadyExist(_ instruction: String) async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "creation-routing-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = root.appending(path: "base.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 320, height: 180), seconds: 4, to: url)
        let original = try await GeneratedOverlayService.save(reply: sceneReply(name: "Existing card", duration: 1),
            brand: nil, moment: [:], size: CGSize(width: 320, height: 180), instruction: "Original", root: root)
        let originalBytes = try Data(contentsOf: original.url)
        let existing = ProjectOverlay(mediaID: original.id, timelineStart: 0.1, duration: 1)
        var requests: [String] = []
        let session = EditorSession(store: CreationRoutingStore(), overlayPlacementService: UnexpectedPlacementPlanner(),
            generatedAssetRoot: root, generatedOverlayRequest: { path, body in
                requests.append(path)
                switch path {
                case "direct-overlays":
                    let placed = try #require(body["placed"] as? [[String: Any]])
                    #expect(placed.count == 1)
                    #expect(placed.first?["name"] as? String == original.name)
                    return ["moments": [["name": "New visual", "quote": "we have grown",
                        "brief": "Show growth", "kind": "other", "aspect": 1.6]]]
                case "design-overlays":
                    let moments = try #require(body["moments"] as? [[String: Any]])
                    return ["scenes": try moments.map { moment in
                        var reply = sceneReply(name: "New visual", duration: try #require(moment["duration"] as? Double))
                        reply["id"] = moment["id"]
                        return reply
                    }]
                case "review-overlay":
                    return ["passed": true, "issues": [String]()]
                default:
                    Issue.record("Unexpected request: \(path)")
                    throw NativeEditorError.aiFailed("Unexpected request")
                }
            })
        await session.importMedia([url])
        let base = try #require(session.project.media.first)
        session.updateProject { project in
            project.media.append(original)
            project.overlays = [existing]
            project.transcript = ["we", "have", "grown"].enumerated().map { index, text in
                TranscriptWord(mediaID: base.id, text: text, start: 2 + Double(index) * 0.5, end: 2.4 + Double(index) * 0.5)
            }
        }
        await session.runLegacyAssistant(instruction: instruction)
        #expect(session.errorMessage == nil)
        #expect(requests == ["direct-overlays", "design-overlays", "review-overlay"])
        #expect(session.project.media.filter(\.isScene).count == 2)
        #expect(session.project.media.first { $0.id == original.id } == original)
        #expect(try Data(contentsOf: original.url) == originalBytes)
        #expect(session.project.overlays?.filter { $0.mediaID == original.id } == [existing])
        let added = try #require(session.project.overlays?.first { $0.mediaID != original.id })
        #expect(added.timelineStart >= existing.timelineStart + existing.duration)
        #expect(session.conversation.messages.last?.tone == .done)
        session.player.replaceCurrentItem(with: nil)
    }

    @Test func placementCannotStackAnAssetOrItsOriginalOverAnExistingReveal() async throws {
        let session = EditorSession(store: CreationRoutingStore())
        await Task.yield()
        let base = ProjectMedia(url: URL(filePath: "/tmp/placement-base.mov"), name: "base", duration: 10,
                                width: 320, height: 180, hasAudio: false, kind: .video)
        let source = ProjectMedia(url: URL(filePath: "/tmp/placement-card.png"), name: "Card", duration: 4,
                                  width: 320, height: 180, hasAudio: false, kind: .image)
        var record = GeneratedOverlayRecord(description: "Reveal", brief: "", quote: "", palette: .house)
        record.revealSourceMediaID = source.id
        let reveal = ProjectMedia(url: URL(filePath: "/tmp/placement-reveal.json"), name: "Reveal", duration: 4,
                                  width: 320, height: 180, hasAudio: false, kind: .scene, generated: record)
        let existing = ProjectOverlay(mediaID: reveal.id, timelineStart: 0, duration: 4)
        let words = [TranscriptWord(mediaID: base.id, text: "early", start: 1, end: 2),
                     TranscriptWord(mediaID: base.id, text: "later", start: 6, end: 7)]
        session.updateProject { project in
            project = EditorProject(media: [base, source, reveal],
                clips: [.init(mediaID: base.id, sourceStart: 0, sourceEnd: 10)], transcript: words, overlays: [existing])
        }
        let duplicateSpans = [source, reveal].map {
            PlacedOverlaySpan(file: $0.name, reason: nil, firstWord: 0, lastWord: 0, sound: "pop")
        }
        let skipped = await session.applyPlacedSpans(duplicateSpans, words: words, files: [source, reveal])
        #expect(skipped.skippedExisting == 2)
        #expect(skipped.notes.isEmpty)
        #expect(skipped.sounds.isEmpty)
        #expect(session.project.overlays == [existing])

        // A later, separate use is allowed; a duplicate inside one reply is not.
        let later = PlacedOverlaySpan(file: source.name, reason: nil, firstWord: 1, lastWord: 1, sound: "pop")
        let added = await session.applyPlacedSpans([later, later], words: words, files: [source])
        #expect(added.notes.count == 1)
        #expect(added.sounds.count == 1)
        #expect(added.skippedExisting == 1)
        #expect(session.project.overlays?.count == 2)
        #expect(session.project.overlays?.first == existing)
    }

    private func sceneReply(name: String, duration: Double) -> [String: Any] {
        ["name": name, "scene": ["version": 1, "duration": duration,
            "nodes": [["id": "panel", "type": "rect", "x": 0, "y": 0,
                       "width": 1, "height": 1, "fill": "#0000FF"]], "animations": []]]
    }
}
