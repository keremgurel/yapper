@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor CaptionTestStore: ProjectPersisting {
    var saves = 0
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws { saves += 1 }
}

/// Caption cards and text layers: the caption list, the timeline, and Chirpy
/// reach the same executors and leave the same saved project.
@MainActor
@Suite(.serialized)
struct CaptionTextActionTests {
    private func fixture() async throws -> (EditorProject, URL) {
        let root = FileManager.default.temporaryDirectory.appending(path: "caption-actions-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appending(path: "video.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 6, to: url)
        let media = try await MediaProbe.inspect(url: url)
        let words = ["one", "two", "three", "four", "five", "six"].enumerated().map { index, text in
            TranscriptWord(mediaID: media.id, text: text, start: Double(index) + 0.2, end: Double(index) + 0.7)
        }
        let project = EditorProject(media: [media], clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 6)],
            transcript: words, captionsEnabled: true, captions: words.map {
                ProjectCaption(mediaID: media.id, text: $0.text, sourceStart: $0.start, sourceEnd: $0.end, wordIDs: [$0.id])
            })
        return (project, root)
    }

    private func session(_ project: EditorProject, plan: @escaping @Sendable (String) throws -> ChirpyPlanReply) async -> EditorSession {
        let session = EditorSession(store: CaptionTestStore())
        await Task.yield()
        session.updateProject { $0 = project }
        session.chirpyPlanner = { payload in try plan(payload["messages"]!.list!.last!["content"]!.text!) }
        return session
    }

    nonisolated private static func reply(_ input: some AppActionInput) throws -> ChirpyPlanReply {
        guard case .object(let fields) = try ActionJSON.encoding(input) else { throw AppActionError("bad test input") }
        return .init(message: "Planned", actions: [.init(action: type(of: input).actionID.rawValue, arguments: fields)])
    }

    private func settle(_ session: EditorSession, until count: Int) async {
        for _ in 0..<2000 where session.appActions.recentResults.count < count { await Task.yield() }
    }

    private func release(_ sessions: EditorSession...) {
        for session in sessions { session.player.replaceCurrentItem(with: nil) }
    }

    @Test func captionTextMergeAndRemoveMatchTheCaptionList() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let ids = project.storedCaptions.map(\.id)
        let ui = await session(project) { _ in throw AppActionError("unused") }
        let chat = await session(project) { instruction in
            instruction.contains("merge")
                ? try Self.reply(CaptionMergeInput(captionIDs: [ids[1], ids[2]]))
                : instruction.contains("remove")
                    ? try Self.reply(CaptionRemoveInput(captionIDs: [ids[5]]))
                    : try Self.reply(CaptionTextInput(captionID: ids[0], text: "ONE!"))
        }
        // Chirpy rewrites a card; the list types the same text (live path).
        await chat.runAssistant(instruction: "change the first caption to ONE!")
        #expect(chat.captionTexts[ids[0]] == "ONE!")
        let text = try #require(chat.appActions.recentResults.last)
        #expect(text.changes == [.init(targetID: ids[0], property: "text", before: "one", after: "ONE!")])

        ui.setSelectedCaptionIDs([ids[1], ids[2]])
        await ui.mergeSelectedCaptions()
        await chat.runAssistant(instruction: "merge two and three")
        #expect(ui.project.storedCaptions.count == 5 && chat.project.storedCaptions.count == 5)
        #expect(ui.project.storedCaptions.map(\.sourceStart) == chat.project.storedCaptions.map(\.sourceStart))
        let merge = try #require(chat.appActions.recentResults.last)
        #expect(merge.status == .applied && merge.changes.count == 1 && merge.changes[0].property == "mergedInto")

        await ui.removeCaption(ids[5])
        await chat.runAssistant(instruction: "remove the last caption")
        #expect(ui.project.storedCaptions.count == 4 && chat.project.storedCaptions.count == 4)
        #expect(chat.appActions.recentResults.last?.changes == [.init(targetID: ids[5], property: "removed", before: "caption", after: "none")])
        release(ui, chat)
    }

    @Test func captionsCanBeAddedRetimedAndLockedOnesRefuse() async throws {
        var (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        project.captions![0].isLocked = true
        let ids = project.storedCaptions.map(\.id)
        let chat = await session(project) { instruction in
            instruction.contains("after")
                ? try Self.reply(CaptionAddInput(at: nil, afterCaptionID: ids[3], text: "extra"))
                : instruction.contains("move")
                    ? try Self.reply(CaptionRetimeInput(captionID: ids[4], timelineStart: 4.3, timelineEnd: 4.9))
                    : try Self.reply(CaptionTextInput(captionID: ids[0], text: "nope"))
        }
        await chat.runAssistant(instruction: "add a card after four saying extra")
        let added = try #require(chat.appActions.recentResults.last)
        #expect(added.status == .applied && added.changes.first?.property == "added")
        #expect(chat.project.storedCaptions.count == 7)
        let newID = try #require(added.changes.first?.targetID)
        #expect(chat.captionTexts[newID] == "extra")
        #expect(chat.selectedCaptionIDs == [newID])

        await chat.runAssistant(instruction: "move five a bit")
        let moved = try #require(chat.appActions.recentResults.last)
        #expect(moved.status == .applied)
        #expect(chat.captionCue(ids[4])?.timelineStart == 4.3)

        await chat.runAssistant(instruction: "rewrite the locked one")
        #expect(chat.appActions.recentResults.last?.status == .rejected)
        #expect(chat.project.storedCaptions[0].text == "one")
        release(chat)
    }

    @Test func textLayersAddUpdateAndDeleteThroughActions() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let ui = await session(project) { _ in throw AppActionError("unused") }
        let chat = await session(project) { instruction in
            instruction.contains("hook")
                ? try Self.reply(TextLayerAddInput(text: "Your hook", at: .playhead, duration: nil, asHook: true))
                : try Self.reply(TextLayerUpdateInput(textLayerID: UUID(), text: nil, timelineStart: nil, duration: nil))
        }
        ui.addTextLayer(asHook: true)
        await settle(ui, until: 1)
        await chat.runAssistant(instruction: "add a hook")
        let uiLayer = try #require(ui.project.textLayers?.first), chatLayer = try #require(chat.project.textLayers?.first)
        #expect(uiLayer.text == chatLayer.text && uiLayer.timelineStart == 0 && chatLayer.timelineStart == 0)
        #expect(uiLayer.appearance == chatLayer.appearance && uiLayer.duration == chatLayer.duration)
        #expect(ui.selectedTextLayerID == uiLayer.id)
        #expect(ui.inspectorRequest?.tool == "Text")

        let update = await chat.appActions.execute(
            try chat.actionRequest(TextLayerUpdateInput(textLayerID: chatLayer.id, text: "Better hook", timelineStart: 1, duration: 2)), in: chat)
        #expect(update.status == .applied)
        #expect(Set(update.changes.map(\.property)) == ["text", "timelineStart", "duration"])
        #expect(chat.project.textLayers?.first?.text == "Better hook")

        ui.selectTextLayer(uiLayer.id)
        ui.deleteSelectedTextLayer()
        await settle(ui, until: 2)
        #expect(ui.project.textLayers?.isEmpty == true)
        #expect(ui.appActions.recentResults.last?.action == AppActionID.timelineDelete.rawValue)
        release(ui, chat)
    }
}
