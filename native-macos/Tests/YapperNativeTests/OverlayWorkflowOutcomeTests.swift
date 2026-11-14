import AppKit
import Foundation
import Testing
@testable import YapperNative

/// A design run that lands nothing has to say why.
struct OverlayWorkflowOutcomeTests {
    @Test func aFailedDesignNamesTheServersReason() {
        #expect(OverlayWorkflowOutcome.skippedDesign(name: "Stopwatch", reason: "answer_truncated")
            == "Couldn’t generate Stopwatch: the designer ran out of room before finishing it.")
        #expect(OverlayWorkflowOutcome.skippedDesign(name: "Stopwatch", reason: nil)
            == "Couldn’t generate Stopwatch; it was skipped.")
    }

    @Test func nothingChangedCarriesTheNotes() {
        let status = OverlayPlacementStatus.generated(notes: ["Couldn’t generate Stopwatch: the designer took too long."], changed: 0)
        #expect(OverlayWorkflowOutcome.nothingChanged(status)
            == "No overlay was added. Couldn’t generate Stopwatch: the designer took too long.")
        #expect(OverlayWorkflowOutcome.nothingChanged(.placed(notes: [])) == "No overlay was added.")
    }

    @Test func anUnchangedWorkflowNeverReportsReady() {
        #expect(ChirpyReceiptSummary.unchangedWorkflow(status: "Ready") == "That finished without changing anything in the project.")
        #expect(ChirpyReceiptSummary.unchangedWorkflow(status: "Silences already trimmed") == "Silences already trimmed")
    }
}

private actor OutcomeStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

@MainActor
@Suite(.serialized)
struct OverlayWorkflowNothingLandedTests {
    @Test func chirpyExplainsADesignThatRanOutOfRoom() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "overlay-outcome-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = root.appending(path: "take.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 320, height: 180), seconds: 4, to: url)
        let session = EditorSession(store: OutcomeStore(), generatedAssetRoot: root, generatedOverlayRequest: { path, body in
            switch path {
            case "direct-overlays":
                return ["moments": [["name": "Five minute stopwatch", "quote": "five minutes on the phone",
                    "brief": "A stopwatch to 5:00", "kind": "counter", "aspect": 1]]]
            case "design-overlays":
                let id = (body["moments"] as? [[String: Any]])?.first?["id"] as? String ?? ""
                return ["scenes": [[String: Any]](), "failed": [["id": id, "reason": "answer_truncated"]]]
            default:
                throw NativeEditorError.aiFailed("Unexpected request \(path)")
            }
        })
        defer { session.player.replaceCurrentItem(with: nil) }
        await session.importMedia([url])
        let base = try #require(session.project.media.first)
        session.updateProject { project in
            project.transcript = ["five", "minutes", "on", "the", "phone"].enumerated().map { index, text in
                TranscriptWord(mediaID: base.id, text: text, start: 1 + Double(index) * 0.4, end: 1.3 + Double(index) * 0.4)
            }
        }
        let instruction = "Design an overlay while I say 'five minutes on the phone': a stopwatch to 5:00"
        session.chirpyPlanner = { _ in
            guard case .object(let fields) = try ActionJSON.encoding(
                OverlayWorkflowInput(instruction: instruction, mode: .create, mediaIDs: nil)) else { throw AppActionError("bad") }
            return .init(message: "Designing it", actions: [.init(action: OverlayWorkflowInput.actionID.rawValue, arguments: fields)])
        }
        let before = session.project

        await session.runAssistant(instruction: instruction)

        #expect(session.project.overlays ?? [] == before.overlays ?? [])
        let reply = try #require(session.conversation.messages.last)
        #expect(reply.tone == .trouble)
        #expect(reply.text != "Ready")
        #expect(reply.notes.contains { $0.contains("Five minute stopwatch") && $0.contains("ran out of room") })
    }
}
