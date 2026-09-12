@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor ActionTestStore: ProjectPersisting {
    var saves: [EditorProject] = []
    var fails = false
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {
        if fails { throw CocoaError(.fileWriteNoPermission) }
        saves.append(project)
    }
    func failSaves() { fails = true }
}

@MainActor
@Suite(.serialized)
struct AppActionRegistryTests {
    private func fixture() -> EditorProject {
        let id = UUID()
        let word = TranscriptWord(mediaID: id, text: "hello", start: 0.2, end: 0.6)
        return EditorProject(clips: [TimelineClip(mediaID: id, sourceStart: 0, sourceEnd: 2)],
            transcript: [word], captionsEnabled: true,
            captions: [ProjectCaption(mediaID: id, text: "hello", sourceStart: 0.2, sourceEnd: 0.6, wordIDs: [word.id])])
    }

    private func session(_ project: EditorProject, store: ActionTestStore = ActionTestStore()) async -> EditorSession {
        let session = EditorSession(store: store)
        await Task.yield()
        session.updateProject { $0 = project }
        session.chirpyPlanner = { payload in
            let instruction = payload["messages"]!.list!.last!["content"]!.text!
            let action: String
            let arguments: ActionJSON
            if instruction.contains("captions") && instruction.contains("lock") {
                action = AppActionID.timelineLock.rawValue
                arguments = try .encoding(TimelineLockInput(clipIDs: [], captionIDs: project.storedCaptions.map(\.id), locked: !instruction.hasPrefix("unlock")))
            } else if instruction == "hide captions" {
                action = AppActionID.captionVisibility.rawValue
                arguments = try .encoding(CaptionVisibilityInput(visible: false))
            } else {
                action = AppActionID.clipSpeed.rawValue
                arguments = try .encoding(ClipSpeedInput(clipIDs: project.clips.map(\.id), rate: 2))
            }
            guard case .object(let fields) = arguments else { throw AppActionError("Invalid test arguments") }
            return .init(message: "Planned", actions: [.init(action: action, arguments: fields)])
        }
        return session
    }

    private func normalized(_ project: EditorProject) -> EditorProject {
        var copy = project; copy.updatedAt = Date(timeIntervalSince1970: 0); return copy
    }

    @Test func uiAndAssistantLocksAndVisibilitySaveEquivalentState() async throws {
        let project = fixture()
        let uiStore = ActionTestStore(), chatStore = ActionTestStore()
        let ui = await session(project, store: uiStore), chat = await session(project, store: chatStore)
        let items = Set(project.storedCaptions.map { TimelineSelectionItem.caption($0.id) })
        #expect(await ui.setTimelineItemsLocked(true, items: items))
        await chat.runAssistant(instruction: "lock all captions")
        #expect(normalized(ui.project) == normalized(chat.project))
        #expect(chat.conversation.messages.last?.tone == .done)
        #expect(ui.appActions.recentResults.last?.action == AppActionID.timelineLock.rawValue)
        #expect(chat.appActions.recentResults.last?.action == AppActionID.timelineLock.rawValue)
        #expect(await ui.setTimelineItemsLocked(false, items: items))
        await chat.runAssistant(instruction: "unlock all captions")
        _ = await ui.toggleCaptions()
        await chat.runAssistant(instruction: "hide captions")
        #expect(normalized(ui.project) == normalized(chat.project))
        #expect(ui.project.captionsEnabled == false)
        #expect(ui.project.storedCaptions == project.storedCaptions)
        #expect(await uiStore.saves.map(normalized) == chatStore.saves.map(normalized))
        let saveCount = await chatStore.saves.count
        await chat.runAssistant(instruction: "hide captions")
        #expect(chat.appActions.recentResults.last?.status == .unchanged)
        #expect(await chatStore.saves.count == saveCount)
        #expect(chat.conversation.messages.last?.tone == .done)
    }

    @Test func speedUsesSameExecutorForUIAndChatAndOneUndoRestoresProject() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "action-speed-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = root.appending(path: "video.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 4, to: url)
        let media = try await MediaProbe.inspect(url: url)
        let project = EditorProject(media: [media], clips: [
            TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 2),
            TimelineClip(mediaID: media.id, sourceStart: 2, sourceEnd: 4, isLocked: true),
        ])
        let ui = await session(project), chat = await session(project)
        #expect(await ui.setClipSpeed(2, applyToAll: true))
        await chat.runAssistant(instruction: "set all clips to 2x")
        #expect(normalized(ui.project) == normalized(chat.project))
        let receipt = try #require(chat.appActions.recentResults.last)
        #expect(receipt.status == .applied && receipt.persisted)
        #expect(receipt.changes.map(\.targetID) == [project.clips[0].id])
        #expect(receipt.skippedIDs == [project.clips[1].id])
        #expect(receipt.changes.first?.before == "1.0")
        #expect(receipt.changes.first?.after == "2.0")
        #expect(chat.project.clips[1] == project.clips[1])
        await chat.undo()
        #expect(chat.project == project)
        await chat.redo()
        #expect(normalized(chat.project) == normalized(ui.project))
        ui.player.replaceCurrentItem(with: nil); chat.player.replaceCurrentItem(with: nil)
    }

    @Test func rejectsUnknownIDsExtraFieldsAndInvalidWireTypesWithoutSaving() async throws {
        let project = fixture(), store = ActionTestStore()
        let session = await session(project, store: store)
        func request(_ action: String, _ args: [String: ActionJSON], version: Int = 1) -> AppActionRequest {
            .init(protocolVersion: version, id: UUID(), projectID: project.id, revision: session.actionRevision,
                  action: action, arguments: args)
        }
        let cases = [
            request("editor.unknown", [:]),
            request(AppActionID.captionVisibility.rawValue, ["visible": .bool(false)], version: 2),
            request(AppActionID.captionVisibility.rawValue, ["visible": .number(0)]),
            request(AppActionID.captionVisibility.rawValue, ["visible": .bool(false), "delete": .bool(true)]),
            request(AppActionID.timelineLock.rawValue, ["clipIDs": .array([.string(UUID().uuidString)]), "captionIDs": .array([]), "locked": .bool(true)]),
            request(AppActionID.clipSpeed.rawValue, ["clipIDs": .array([.string(project.clips[0].id.uuidString)]), "rate": .number(5)]),
            request(AppActionID.clipSpeed.rawValue, ["clipIDs": .array([.string("not-an-id")]), "rate": .number(1)]),
        ]
        for call in cases {
            let result = await session.appActions.execute(call, in: session)
            #expect(result.status == .rejected)
            #expect(!result.persisted && result.changes.isEmpty)
            #expect(session.project == project)
        }
        #expect(await store.saves.isEmpty)
    }

    @Test func staleRevisionAndProjectSwitchAreCheckedAgainAfterWaitingForTheEditSlot() async throws {
        let project = fixture(), store = ActionTestStore()
        let session = await session(project, store: store)
        let request = try session.actionRequest(TimelineLockInput(clipIDs: [project.clips[0].id], captionIDs: [], locked: true))
        _ = try #require(await session.beginPreparedTimelineEdit())
        let queued = Task { @MainActor in await session.appActions.execute(request, in: session) }
        await Task.yield()
        session.updateProject { $0.name = "Changed while queued" }
        let edited = session.project
        session.endPreparedTimelineEdit()
        #expect(await queued.value.status == .rejected)
        #expect(session.project == edited)
        session.updateProject { $0 = fixture() }
        #expect(await session.appActions.execute(request, in: session).status == .rejected)
        #expect(await store.saves.isEmpty)
    }

    @Test func failedSaveRollsBackAndAssistantNeverAnnouncesSuccess() async throws {
        let project = fixture(), store = ActionTestStore()
        let session = await session(project, store: store)
        await store.failSaves()
        await session.runAssistant(instruction: "lock all captions")
        #expect(session.project == project)
        #expect(!session.canUndo)
        #expect(session.conversation.messages.last?.tone == .trouble)
        let result = try #require(session.appActions.recentResults.last)
        #expect(result.status == .failed && !result.persisted && result.changes.isEmpty)
    }

    @Test func everyDeclaredNativeActionHasAnExecutor() {
        #expect(Set(AppActionRegistry.editor().descriptors.map(\.id)) == Set(AppActionID.allCases.map(\.rawValue)))
    }

    @Test func registeringAFeatureMakesItDiscoverableAndExecutableWithoutRouterChanges() async throws {
        let registry = AppActionRegistry()
        #expect(registry.descriptors.isEmpty)
        registry.register(TimelineLockInput.self, availability: { _ in .available }) { session, _ in
            session.updateProject { $0.name = "Feature executor reached" }
            return AppActionMutation(message: "Test action executed")
        }
        let session = await session(fixture())
        let call = try session.actionRequest(TimelineLockInput(clipIDs: [], captionIDs: [], locked: false))
        #expect(registry.descriptors.map(\.id) == [call.action])
        #expect(registry.availability(.timelineLock, in: session).isAvailable)
        #expect(await registry.execute(call, in: session).status == .applied)
        #expect(session.project.name == "Feature executor reached")
        let value = try ActionJSON.encoding(try #require(registry.recentResults.last))
        try ActionSchema.validate(value, against: ActionSchema.definition("AppActionResult"))
    }

    @Test func cancellationDuringAnActionRestoresTheSnapshotWithoutSaving() async throws {
        let registry = AppActionRegistry(), project = fixture(), store = ActionTestStore()
        let session = await session(project, store: store)
        var began = false
        registry.register(TimelineLockInput.self, availability: { _ in .available }) { session, _ in
            session.updateProject { $0.name = "Not committed" }
            began = true
            try await Task.sleep(for: .seconds(30))
            return AppActionMutation(message: "Should not complete")
        }
        let request = try session.actionRequest(TimelineLockInput(clipIDs: [], captionIDs: [], locked: false))
        let task = Task { @MainActor in await registry.execute(request, in: session) }
        while !began { await Task.yield() }
        task.cancel()
        let result = await task.value
        #expect(result.status == .canceled && !result.persisted)
        #expect(session.project == project)
        #expect(!session.canUndo)
        #expect(await store.saves.isEmpty)
    }
}
