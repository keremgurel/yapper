@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

/// How a plan's receipts read once it has run.
struct ChirpyReceiptSummaryTests {
    @Test func identicalSuccessesAreCountedAndOfferUndoOnce() {
        let added = Array(repeating: "Overlay added · ⌘Z to undo", count: 3)
        #expect(ChirpyReceiptSummary.success(added) == "3 overlays added · ⌘Z to undo")
        #expect(ChirpyReceiptSummary.success(["Overlay added · ⌘Z to undo"]) == "Overlay added · ⌘Z to undo")
        #expect(ChirpyReceiptSummary.success(["Hook added · “Hi”", "Overlay added · ⌘Z to undo", "Overlay added · ⌘Z to undo"])
            == "Hook added · “Hi”\n2 overlays added · ⌘Z to undo")
    }

    @Test func countsReadNaturally() {
        #expect(ChirpyReceiptSummary.counted("Text added · “Hi”", times: 2) == "2 texts added · “Hi”")
        #expect(ChirpyReceiptSummary.counted("Box moved", times: 2) == "2 boxes moved")
        #expect(ChirpyReceiptSummary.counted("Story added", times: 3) == "3 stories added")
        #expect(ChirpyReceiptSummary.counted("Media edit saved", times: 2) == "Media edit saved (2×)")
    }

    @Test func aFailedPlanNamesItsProblemOnceAndCountsTheRest() {
        let rolledBack = ChirpyReceiptSummary.rolledBack
        #expect(ChirpyReceiptSummary.troubleNotes([rolledBack, "That text layer is gone.", rolledBack, rolledBack])
            == ["That text layer is gone.", "The other 3 steps in this plan were not applied, so nothing changed."])
        #expect(ChirpyReceiptSummary.troubleNotes([rolledBack, "Broke."])
            == ["Broke.", "The other step in this plan was not applied, so nothing changed."])
        // A reason that applies to the whole plan arrives on every receipt.
        let busy = Array(repeating: "Wait for the current operation to finish.", count: 4)
        #expect(ChirpyReceiptSummary.troubleNotes(busy) == ["Wait for the current operation to finish."])
    }
}

private actor ReceiptTestStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {}
}

/// A plan run end to end through the registry and the planner.
@MainActor
@Suite(.serialized)
struct ChirpyBatchReceiptTests {
    private func session() async throws -> (EditorSession, URL) {
        let root = FileManager.default.temporaryDirectory.appending(path: "chirpy-receipts-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appending(path: "video.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 4, to: url)
        let media = try await MediaProbe.inspect(url: url)
        let session = EditorSession(store: ReceiptTestStore())
        await Task.yield()
        session.updateProject {
            $0 = EditorProject(media: [media], clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 4)])
        }
        return (session, root)
    }

    nonisolated private static func call(_ input: some AppActionInput) throws -> ChirpyActionCall {
        guard case .object(let fields) = try ActionJSON.encoding(input) else { throw AppActionError("bad test input") }
        return .init(action: type(of: input).actionID.rawValue, arguments: fields)
    }

    nonisolated private static func addText(_ text: String) throws -> ChirpyActionCall {
        try call(TextLayerAddInput(text: text, at: .playhead, duration: nil, asHook: nil, style: nil))
    }

    @Test func onlyTheFailingStepCarriesTheError() async throws {
        let (session, root) = try await session()
        defer { try? FileManager.default.removeItem(at: root); session.player.replaceCurrentItem(with: nil) }
        let missing = try Self.call(TextLayerUpdateInput(textLayerID: UUID(), text: "x", timelineStart: nil, duration: nil))
        session.chirpyPlanner = { _ in .init(message: "Planned", actions: [try Self.addText("One"), missing, try Self.addText("Two")]) }

        await session.runAssistant(instruction: "add two texts and fix one")

        let receipts = session.appActions.recentResults.suffix(3)
        #expect(receipts.allSatisfy { $0.status == .rejected })
        #expect(receipts.map(\.message) == [
            ChirpyReceiptSummary.rolledBack, "A requested text layer no longer exists.", ChirpyReceiptSummary.rolledBack,
        ])
        #expect(session.project.textLayers?.isEmpty ?? true)
        let reply = try #require(session.conversation.messages.last)
        #expect(reply.tone == .trouble)
        #expect(reply.notes == [
            "A requested text layer no longer exists.",
            "The other 2 steps in this plan were not applied, so nothing changed.",
        ])
    }

    @Test func aTextLayerCanBeAddedAlreadyStyled() async throws {
        let (session, root) = try await session()
        defer { try? FileManager.default.removeItem(at: root); session.player.replaceCurrentItem(with: nil) }
        let style: [String: ActionJSON] = [
            "font": .string("editorial"), "fontScale": .number(0.08), "y": .number(0.3),
            "color": .string("#FFCC00"), "backgroundEnabled": .bool(false),
        ]
        session.chirpyPlanner = { _ in .init(message: "Planned", actions: [
            .init(action: AppActionID.textLayerAdd.rawValue, arguments: ["text": .string("Comment TEF"), "style": .object(style)]),
        ]) }

        await session.runAssistant(instruction: "add Comment TEF in yellow, editorial, near the top")

        let layer = try #require(session.project.textLayers?.first)
        #expect(session.conversation.messages.last?.tone == .done)
        #expect(layer.appearance.font == .editorial)
        #expect(layer.appearance.fontScale == 0.08)
        #expect(layer.y == 0.3)
        #expect(layer.appearance.color.hex.uppercased().hasPrefix("#FFCC00"))
        #expect(!layer.appearance.backgroundEnabled)
        // Everything the style left out is the default look.
        #expect(layer.width == 0.7 && layer.appearance.textCase == TextAppearance.textLayerDefault.textCase)
    }

    @Test func identicalSuccessesAreGroupedInTheReply() async throws {
        let (session, root) = try await session()
        defer { try? FileManager.default.removeItem(at: root); session.player.replaceCurrentItem(with: nil) }
        session.chirpyPlanner = { _ in .init(message: "Planned", actions: try (0..<3).map { _ in try Self.addText("Hi") }) }

        await session.runAssistant(instruction: "add three texts")

        #expect(session.project.textLayers?.count == 3)
        let reply = try #require(session.conversation.messages.last)
        #expect(reply.tone == .done)
        #expect(reply.text == "3 texts added · “Hi”")
    }
}
