@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor ChirpyTestStore: ProjectPersisting {
    var saves = 0
    var fail = false
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {
        if fail { throw CocoaError(.fileWriteNoPermission) }
        saves += 1
    }
    func failSaving() { fail = true }
}

@MainActor
@Suite(.serialized)
struct ContextualChirpyTests {
    private func fixture(root: URL) async throws -> (EditorSession, ChirpyTestStore) {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let videoURL = root.appending(path: "video.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 10, to: videoURL)
        let video = try await MediaProbe.inspect(url: videoURL)
        let regions = ["Clicks", "Impressions", "Avg. CPC", "Cost"].enumerated().map { index, label in
            SavedRevealRegion(id: "number-\(index)", text: ["34", "291", "CA$1.10", "CA$37.47"][index], label: label,
                confidence: 1, box: CGRect(x: Double(index) * 0.25, y: 0.2, width: 0.2, height: 0.5), background: .white,
                policy: index == 0 || index == 3 ? .untilCue : .alwaysHidden,
                cueTime: index == 0 ? 4.581 : index == 3 ? 2.856 : nil)
        }
        let scene = OverlayScene(duration: 6, nodes: regions.map { region in
            var node = SceneNode(id: region.id, kind: .rect, x: region.box.minX, y: region.box.minY, width: region.box.width, height: region.box.height)
            node.fill = .hex(.white); return node
        }, animations: regions.compactMap { region in region.cueTime.map { .init(node: region.id, property: .opacity, from: 1, to: 0, start: $0, end: $0 + 0.16) } })
        let sceneURL = root.appending(path: "test.scene.json")
        try scene.encoded().write(to: sceneURL)
        var record = GeneratedOverlayRecord(description: "Google Ads", brief: "", quote: "", palette: .house)
        record.revealSourceMediaID = UUID(); record.revealRegions = regions
        let media = ProjectMedia(url: sceneURL, name: "Google Ads spoken reveal", duration: 6, width: 742, height: 105, hasAudio: false, kind: .scene, generated: record)
        let project = EditorProject(media: [video, media], clips: [.init(mediaID: video.id, sourceStart: 0, sourceEnd: 10)], overlays: [.init(mediaID: media.id, timelineStart: 3.668, duration: 6)])
        let store = ChirpyTestStore(), session = EditorSession(store: store, generatedAssetRoot: root)
        await Task.yield()
        session.updateProject { $0 = project }
        session.projectNavigation.currentPackage = ProjectPackage(url: root)
        return (session, store)
    }

    @Test func correctionAndSoundRequestUseRealEventsPreserveOtherMasksAndSurviveReopen() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "chirpy-context-\(UUID())")
        defer { try? FileManager.default.removeItem(at: root) }
        let (session, store) = try await fixture(root: root)
        let original = session.project
        let overlay = try #require(session.overlays.first)
        let originalScene = try SceneExportLayer.loadScene(for: session.media(for: overlay)!)
        var sawHistory = false
        session.chirpyPlanner = { payload in
            let messages = payload["messages"]!.list!
            let text = messages.last!["content"]!.text!
            if text.contains("CPC") {
                return ChirpyPlanReply(message: "Planned only, must never appear as success.", actions: ["number-1", "number-2"].map {
                    .init(action: AppActionID.maskRemove.rawValue, arguments: ["overlayID": .string(overlay.id.uuidString), "regionID": .string($0)])
                })
            }
            sawHistory = messages.contains { $0["content"]?.text?.contains("CPC") == true }
            let events = try #require(payload["context"]?["animationEvents"]?.list)
            #expect(zip(events.compactMap { $0["timelineTime"]?.numeric }, [6.684, 8.409]).allSatisfy { abs($0 - $1) < 1e-8 })
            return .init(message: "I added unrelated overlays", actions: [.init(action: AppActionID.soundAt.rawValue,
                arguments: ["effectID": .string("mouse-click"), "at": .array(events.map { .object(["kind": .string("event"), "eventID": $0["id"]!]) })])])
        }
        await session.runAssistant(instruction: "Keep impressions and CPC visible all the time.")
        #expect(session.conversation.messages.last?.tone == .done)
        let revised = try #require(session.media(for: overlay))
        let scene = try SceneExportLayer.loadScene(for: revised)
        #expect(scene.nodes.map(\.id) == ["number-0", "number-3"])
        #expect(scene.animations == originalScene.animations)
        #expect(session.project.overlays == original.overlays)
        let beforeSounds = session.project
        await session.runAssistant(instruction: "add click sound effects when we reveal the clicks and cost")
        #expect(sawHistory)
        #expect(zip(session.project.audioLayers?.map(\.timelineStart) ?? [], [6.684, 8.409]).allSatisfy { abs($0 - $1) < 1e-8 })
        #expect(session.project.overlays == beforeSounds.overlays)
        #expect(session.project.media == beforeSounds.media)
        #expect(session.conversation.messages.last?.text.contains("unrelated") == false)
        let reopened = AssistantConversation()
        reopened.attach(projectID: session.project.id, root: root)
        #expect(reopened.messages == session.conversation.messages)
        #expect(reopened.results.count == 3)
        let saves = await store.saves
        await session.runAssistant(instruction: "add click sound effects when we reveal the clicks and cost")
        #expect(await store.saves == saves)
        await session.undo()
        #expect(session.project == beforeSounds)
        #expect(session.conversation.messages.last?.text.contains("already") == true)
        session.player.replaceCurrentItem(with: nil)
    }

    @Test func atomicBatchAndStalePlanNeverReportPartialSuccess() async throws {
        let store = ChirpyTestStore(), session = EditorSession(store: store)
        await Task.yield()
        let id = UUID()
        session.updateProject { $0 = EditorProject(clips: [.init(mediaID: id, sourceStart: 0, sourceEnd: 2)], captionsEnabled: true) }
        let original = session.project
        session.chirpyPlanner = { _ in
            .init(message: "Done", actions: [
                .init(action: AppActionID.timelineLock.rawValue, arguments: ["clipIDs": .array([.string(original.clips[0].id.uuidString)]), "captionIDs": .array([]), "locked": .bool(true)]),
                .init(action: AppActionID.timelineLock.rawValue, arguments: ["clipIDs": .array([.string(UUID().uuidString)]), "captionIDs": .array([]), "locked": .bool(true)])
            ])
        }
        await session.runAssistant(instruction: "lock those")
        #expect(session.project == original)
        #expect(!session.canUndo)
        #expect(await store.saves == 0)
        #expect(session.conversation.messages.last?.tone == .trouble)
        session.chirpyPlanner = { _ in
            session.updateProject { $0.name = "Manual change while planning" }
            return .init(message: "Done", actions: [.init(action: AppActionID.captionVisibility.rawValue, arguments: ["visible": .bool(false)])])
        }
        await session.runAssistant(instruction: "hide captions")
        #expect(session.project.captionsEnabled == true)
        #expect(session.project.name == "Manual change while planning")
        #expect(session.conversation.messages.last?.tone == .trouble)
    }

    @Test func closingChirpyCancelsPlanningBeforeAnyMutation() async throws {
        let session = EditorSession(store: ChirpyTestStore())
        await Task.yield()
        session.updateProject { $0 = EditorProject(clips: [.init(mediaID: UUID(), sourceStart: 0, sourceEnd: 2)], captionsEnabled: true) }
        var planning = false
        session.chirpyPlanner = { _ in
            planning = true
            try await Task.sleep(for: .seconds(30))
            return .init(message: "Done", actions: [.init(action: AppActionID.captionVisibility.rawValue, arguments: ["visible": .bool(false)])])
        }
        session.toggleAssistant()
        let task = Task { await session.runAssistant(instruction: "hide captions") }
        defer { task.cancel() }
        let deadline = ContinuousClock.now.advanced(by: .seconds(5))
        while !planning, ContinuousClock.now < deadline { try await Task.sleep(for: .milliseconds(1)) }
        try #require(planning, "The injected planner did not start before the deadline.")
        var releaseManual = false, manualWasCanceled = false
        let manual = Task { @MainActor in
            await session.runTrackedLongOperation(.importingMedia) { _ in
                while !releaseManual && !Task.isCancelled { try? await Task.sleep(for: .milliseconds(1)) }
                manualWasCanceled = Task.isCancelled
            }
        }
        defer { manual.cancel() }
        while session.activeOperation == nil, ContinuousClock.now < deadline { try await Task.sleep(for: .milliseconds(1)) }
        try #require(session.activeOperation != nil)
        #expect(session.closeAssistant())
        await task.value
        releaseManual = true
        _ = await manual.value
        #expect(!manualWasCanceled, "Closing Chirpy must not cancel a manual operation started while the model was planning.")
        #expect(session.project.captionsEnabled == true)
        #expect(session.conversation.messages.last?.text == "Request canceled.")
        #expect(!session.conversation.isThinking)
    }

    @Test func interruptedJournalRejectsReplayAfterReopen() throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "chirpy-journal-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let projectID = UUID(), invocationID = UUID()
        let conversation = AssistantConversation(); conversation.attach(projectID: projectID, root: root)
        try conversation.begin(invocationID)
        let reopened = AssistantConversation(); reopened.attach(projectID: projectID, root: root)
        #expect(throws: (any Error).self) { try reopened.begin(invocationID) }
        #expect(reopened.messages.last?.tone == .trouble)
        reopened.attach(projectID: UUID(), root: root)
        #expect(reopened.messages.isEmpty)
    }
}
