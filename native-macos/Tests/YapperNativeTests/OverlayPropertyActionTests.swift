@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor OverlayPropertyStore: ProjectPersisting {
    var saves: [EditorProject] = []
    var failing = false
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {
        if failing { throw CocoaError(.fileWriteNoPermission) }
        saves.append(project)
    }
    func fail() { failing = true }
}

@MainActor
@Suite(.serialized)
struct OverlayPropertyActionTests {
    private func fixture() async throws -> (EditorProject, URL) {
        let root = FileManager.default.temporaryDirectory.appending(path: "overlay-properties-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appending(path: "video.mov")
        try await SyntheticVideo.write(color: NSColor.blue.cgColor, size: CGSize(width: 160, height: 90), seconds: 4, to: url)
        let media = try await MediaProbe.inspect(url: url)
        var project = EditorProject(media: [media], clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 4)])
        project.overlays = (0..<12).map { index in
            ProjectOverlay(mediaID: media.id, timelineStart: Double(index) * 0.3, duration: 0.2,
                           sourceStart: 0.5, x: 0.4, y: 0.1, width: 0.3, height: 0.3,
                           track: index % 3, isHidden: index == 11 ? true : nil)
        }
        var key = OverlayKey(at: 0.1, box: .init(x: 0.2, y: 0.3, width: 0.4, height: 0.4),
                             crop: .init(x: 0.1, y: 0.1, width: 0.5, height: 0.5))
        key.cropEasing = .init(lower: 0.2, upper: 0.8)
        project.overlays?[1].keys = [key]
        return (project, root)
    }
    private func session(_ project: EditorProject, store: OverlayPropertyStore = OverlayPropertyStore()) async -> EditorSession {
        let session = EditorSession(store: store)
        await Task.yield()
        session.updateProject { $0 = project }
        return session
    }
    private func fullFrame(_ ids: [UUID] = [], all: Bool = true, time: Double? = nil) -> OverlayFrameInput {
        .init(overlayIDs: ids, all: all, fit: .full, x: nil, y: nil, width: nil, height: nil, rotation: nil, time: time)
    }
    private func call(_ input: some AppActionInput) throws -> ChirpyActionCall {
        let json = try ActionJSON.encoding(input)
        guard case .object(let fields) = json else { throw AppActionError("Test input is not an object") }
        return .init(action: type(of: input).actionID.rawValue, arguments: fields)
    }

    @Test func allOverlaysFullFrameSavesOneEditAndUndoRedoPreserveTheRest() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = OverlayPropertyStore()
        let session = await session(project, store: store)
        defer { session.player.replaceCurrentItem(with: nil) }
        let action = try call(fullFrame())
        session.chirpyPlanner = { _ in .init(message: "Plan only", actions: [action]) }
        await session.runAssistant(instruction: "make all overlays full screen please")
        let receipt = try #require(session.appActions.recentResults.last)
        #expect(receipt.status == .applied && receipt.persisted)
        #expect(Set(receipt.changes.map(\.targetID)).count == 12)
        #expect(await store.saves.count == 1)
        #expect(session.overlays.allSatisfy(OverlayFrame.isFullFrame))
        for (before, after) in zip(project.overlays!, session.overlays) {
            #expect(before.timelineStart == after.timelineStart && before.duration == after.duration)
            #expect(before.sourceStart == after.sourceStart && before.track == after.track)
            #expect(before.isHidden == after.isHidden && before.crop == after.crop)
            #expect(before.keys?.map(\.crop) == after.keys?.map(\.crop))
            #expect(before.keys?.map(\.cropEasing) == after.keys?.map(\.cropEasing))
            #expect(after.keys?.allSatisfy { $0.box == OverlayBox(x: 0, y: 0, width: 1, height: 1) } ?? true)
        }
        #expect(session.conversation.messages.last?.tone == .done)
        await session.performAppAction(HistoryInput(direction: .undo))
        #expect(session.overlays == project.overlays)
        await session.performAppAction(HistoryInput(direction: .redo))
        #expect(session.overlays.allSatisfy(OverlayFrame.isFullFrame))
    }

    @Test func manualFullFrameAndChirpyUseTheSameExecutor() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let ui = await session(project), chat = await session(project)
        defer { ui.player.replaceCurrentItem(with: nil); chat.player.replaceCurrentItem(with: nil) }
        ui.fillFrameWithOverlay(project.overlays![0])
        for _ in 0..<5000 where ui.appActions.recentResults.isEmpty { await Task.yield() }
        #expect(ui.appActions.recentResults.last?.status == .applied)
        let result = await chat.performAppAction(fullFrame([project.overlays![0].id], all: false))
        #expect(result.status == .applied)
        #expect(ui.overlays == chat.overlays)
        #expect(ui.appActions.recentResults.last?.action == AppActionID.overlayFrame.rawValue)
    }

    @Test func missingTargetsAndLaterBatchFailureNeverPartiallyResize() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = OverlayPropertyStore(), session = await session(project)
        let invalid = fullFrame([project.overlays![0].id, UUID()], all: false)
        let result = await session.performAppAction(invalid)
        #expect(result.status == .rejected && session.overlays == project.overlays)
        let batchSession = await self.session(project, store: store)
        let results = await batchSession.appActions.executeBatch([try call(fullFrame()), try call(invalid)],
            projectID: project.id, revision: batchSession.actionRevision, in: batchSession)
        #expect(results.allSatisfy { $0.status == .rejected })
        #expect(batchSession.overlays == project.overlays)
        #expect(await store.saves.isEmpty)
    }

    @Test func failedPersistenceRollsBackAllFrames() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = OverlayPropertyStore(), session = await session(project, store: store)
        defer { session.player.replaceCurrentItem(with: nil) }
        await store.fail()
        let result = await session.performAppAction(fullFrame())
        #expect(result.status == .failed)
        #expect(session.overlays == project.overlays)
        #expect(!session.canUndo)
    }

    @Test func hidingKeyedOverlaysDoesNotChangeKeysAndCollidingLaneMovesReject() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        defer { session.player.replaceCurrentItem(with: nil) }
        let hidden = await session.performAppAction(OverlayPropertiesInput(overlayIDs: [], all: true,
            hidden: true, behindSpeaker: nil, sourceStart: nil, timelineStart: nil, duration: nil, track: nil))
        #expect(hidden.status == .applied)
        #expect(session.overlays.allSatisfy { !$0.isVisible })
        #expect(session.overlays[1].keys == project.overlays![1].keys)
        let before = session.project
        let collision = await session.performAppAction(OverlayPropertiesInput(overlayIDs: [session.overlays[1].id], all: false,
            hidden: nil, behindSpeaker: nil, sourceStart: nil, timelineStart: 0, duration: nil, track: 0))
        #expect(collision.status == .rejected && session.project == before)
    }
}

extension OverlayPropertyActionTests {
    @Test func projectSettingsAndClipKeyframesAreEditableAndUndoable() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        defer { session.player.replaceCurrentItem(with: nil) }
        let settings = await session.performAppAction(ProjectSettingsInput(aspectRatio: .portrait, filter: .warm,
            filterStrength: 0.4, videoHidden: nil, videoMuted: true))
        #expect(settings.status == .applied)
        #expect(session.project.selectedAspectRatio == .portrait)
        #expect(session.project.resolvedVisualFilter == VisualFilter(id: .warm, strength: 0.4))
        #expect(session.project.isVideoTrackMuted)
        let clip = session.project.clips[0]
        let key = await session.performAppAction(VideoFramingKeyInput(clipID: clip.id, sourceTime: 1, operation: .set,
            destination: nil, scale: 2, x: 0.2, y: nil, rotation: nil))
        #expect(key.status == .applied)
        #expect(session.project.clips[0].framingKeys?.first?.framing.scale == 2)
        let move = await session.performAppAction(VideoFramingKeyInput(clipID: clip.id, sourceTime: 1, operation: .move,
            destination: 2, scale: nil, x: nil, y: nil, rotation: nil))
        #expect(move.status == .applied)
        #expect(session.project.clips[0].framingKeys?.first?.at == 2)
        await session.undo()
        #expect(session.project.clips[0].framingKeys?.first?.at == 1)
        let bad = await session.performAppAction(VideoFramingKeyInput(clipID: clip.id, sourceTime: 8, operation: .clear,
            destination: nil, scale: nil, x: nil, y: nil, rotation: nil))
        #expect(bad.status == .rejected)
    }

    @Test func mediaAppendTransferAndRemovalKeepSourceFilesAndRespectLocks() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        defer { session.player.replaceCurrentItem(with: nil) }
        let media = project.media[0]
        let append = await session.performAppAction(MediaEditInput(mediaIDs: [media.id], operation: .append))
        #expect(append.status == .applied && session.project.clips.count == 2)
        let clip = session.project.clips[1]
        let transfer = await session.performAppAction(TrackTransferInput(itemID: clip.id, direction: .toOverlay,
            at: nil, track: 4, insertionIndex: nil))
        #expect(transfer.status == .applied && session.project.clips.count == 1)
        let overlay = try #require(session.overlays.last)
        #expect(overlay.mediaID == clip.mediaID && overlay.sourceStart == clip.sourceStart)
        let demote = await session.performAppAction(TrackTransferInput(itemID: overlay.id, direction: .toMainTrack,
            at: nil, track: nil, insertionIndex: 1))
        #expect(demote.status == .applied && session.project.clips.count == 2)
        let lock = await session.performAppAction(TimelineLockInput(clipIDs: [session.project.clips[0].id], captionIDs: [], locked: true))
        #expect(lock.status == .applied)
        let remove = await session.performAppAction(MediaEditInput(mediaIDs: [media.id], operation: .remove))
        #expect(remove.status == .rejected)
        #expect(FileManager.default.fileExists(atPath: media.url.path))
        await session.undo()
        let removed = await session.performAppAction(MediaEditInput(mediaIDs: [media.id], operation: .remove))
        #expect(removed.status == .applied && session.project.media.isEmpty)
        #expect(session.project.clips.isEmpty && session.overlays.isEmpty)
        #expect(FileManager.default.fileExists(atPath: media.url.path))
        await session.undo()
        #expect(session.project.media == project.media)
    }

    @Test func audioReplacementPreservesPlacementAndVolumeAndTrimRejectsInvalidSource() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        defer { session.player.replaceCurrentItem(with: nil) }
        let effects = SoundEffectDescriptor.library
        let add = await session.performAppAction(SoundAtInput(effectID: effects[0].id, at: [.playhead]))
        #expect(add.status == .applied)
        let layer = try #require(session.project.audioLayers?.first)
        let replace = await session.performAppAction(AudioReplaceInput(layerIDs: [layer.id], effectID: effects[1].id))
        #expect(replace.status == .applied)
        let replaced = try #require(session.project.audioLayers?.first)
        #expect(replaced.timelineStart == layer.timelineStart && replaced.volume == layer.volume)
        #expect(replaced.builtInID == effects[1].id && replaced.sourceStart == 0)
        let bad = await session.performAppAction(AudioTrimInput(layerIDs: [layer.id], sourceStart: 999, duration: nil))
        #expect(bad.status == .rejected)
        #expect(session.project.audioLayers?.first == replaced)
        let trimmed = await session.performAppAction(AudioTrimInput(layerIDs: [layer.id], sourceStart: nil, duration: 0.02))
        #expect(trimmed.status == .applied)
        #expect(session.project.audioLayers?.first?.duration == 0.02)
    }
}
