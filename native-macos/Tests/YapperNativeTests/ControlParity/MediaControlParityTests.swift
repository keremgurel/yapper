import AppKit
import Foundation
import Testing
@testable import YapperNative

/// The media bin, moving items between tracks, sounds from the library and
/// the timeline clipboard save what the matching Chirpy plan saves.
@MainActor
@Suite(.serialized)
struct MediaControlParityTests {
    /// New layers get fresh IDs on each editor; everything else must match.
    private func sameSounds(_ lhs: EditorProject, _ rhs: EditorProject) -> Bool {
        func anonymous(_ project: EditorProject) -> EditorProject {
            var copy = parity(project)
            copy.audioLayers = copy.audioLayers?.map { var layer = $0; layer.id = UUID(uuidString: "00000000-0000-0000-0000-000000000000")!; return layer }
            return copy
        }
        return anonymous(lhs) == anonymous(rhs)
    }

    @Test func mediaBinMatchesTheMediaAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        await ui.appendMediaToTimeline(h.video.id)
        let appended = try await chat.chirpy(MediaEditInput(mediaIDs: [h.video.id], operation: .append))
        #expect(ui.lastReceipt?.action == "editor.media.edit" && ui.lastReceipt?.status == .applied)
        #expect(ui.project.clips.count == 3)
        // The new clip is a fresh ID on each side; the rest is equal.
        #expect(ui.project.clips.dropLast() == chat.project.clips.dropLast())
        #expect(appended.changes.count == 1)

        for session in [ui, chat] { await session.undo() }
        await ui.resetMediaToSource(h.video.id)
        try await chat.chirpy(MediaEditInput(mediaIDs: [h.video.id], operation: .resetToSource))
        #expect(ui.project.clips.count == 1)
        #expect(ui.project.clips.map(\.sourceStart) == chat.project.clips.map(\.sourceStart))
        #expect(ui.project.clips.map(\.sourceEnd) == chat.project.clips.map(\.sourceEnd))

        for session in [ui, chat] { await session.undo() }
        ui.selectAllMedia()
        await ui.deleteSelectedMedia()
        try await chat.chirpy(MediaEditInput(mediaIDs: [h.video.id], operation: .remove))
        #expect(ui.project.media.isEmpty)
        #expect(parity(ui.project) == parity(chat.project))
        #expect(ui.statusMessage.hasPrefix("Removed take.mov"))
    }

    @Test func liftingAndDroppingMatchTheTransferAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let clip = h.project.clips[1]
        await ui.promoteClipToOverlay(clip.id, start: 2.5, lane: 1)
        try await chat.chirpy(TrackTransferInput(itemID: clip.id, direction: .toOverlay, at: .time(2.5), track: 1, insertionIndex: nil))
        #expect(ui.lastReceipt?.action == "editor.timeline.transfer" && ui.lastReceipt?.status == .applied)
        #expect(ui.project.clips.count == 1)
        func lifted(_ session: EditorSession) -> ProjectOverlay? { session.project.overlays?.first { $0.lane == 1 } }
        var uiLifted = try #require(lifted(ui)), chatLifted = try #require(lifted(chat))
        chatLifted.id = uiLifted.id
        #expect(uiLifted == chatLifted)

        let overlay = h.project.overlays![0]
        await ui.demoteOverlayToClip(overlay.id, insertionIndex: 1)
        try await chat.chirpy(TrackTransferInput(itemID: overlay.id, direction: .toMainTrack, at: nil, track: nil, insertionIndex: 1))
        #expect(ui.project.clips.count == 2)
        #expect(ui.project.clips.map(\.sourceStart) == chat.project.clips.map(\.sourceStart))
        uiLifted = try #require(lifted(ui))
        chatLifted = try #require(lifted(chat))
        chatLifted.id = uiLifted.id
        #expect(uiLifted == chatLifted)
    }

    @Test func soundDeleteAndPasteMatchTheirActions() async throws {
        let h = try await ControlParityHarness.make()
        let effect = try #require(SoundEffectDescriptor.library.first { $0.id == "swoosh" })
        let url = try #require(SoundEffectService.shared.bundledURL(for: effect))
        var project = h.project
        let layer = ProjectAudioLayer(url: url, name: effect.name, timelineStart: 0.2, duration: 0.4, sourceStart: 0.1,
                                      sourceDuration: effect.duration, volume: 0.6, builtInID: effect.id, sourceKind: .builtIn)
        project.audioLayers = [layer]
        let (ui, _) = try await h.session(project), (chat, _) = try await h.session(project)
        defer { h.cleanUp(ui, chat) }
        let board = NSPasteboard.withUniqueName()
        defer { board.releaseGlobally() }
        ui.timelinePasteboard = board
        chat.timelinePasteboard = board

        ui.selectAudioLayer(layer.id)
        #expect(ui.copyTimelineAudio())
        ui.scrub(to: 2)
        #expect(await ui.pasteTimelineAudio())
        try await chat.chirpy(AudioPasteInput(at: .time(2)))
        #expect(ui.lastReceipt?.action == "editor.audio.paste" && ui.lastReceipt?.status == .applied)
        #expect(ui.project.audioLayers?.count == 2)
        #expect(sameSounds(ui.project, chat.project))

        ui.selectAudioLayer(layer.id)
        await ui.deleteSelectedAudioLayer()
        try await chat.chirpy(TimelineDeleteInput(itemIDs: [layer.id]))
        #expect(ui.lastReceipt?.action == "editor.timeline.delete")
        #expect(ui.project.audioLayers?.count == 1)
        #expect(sameSounds(ui.project, chat.project))
    }

    @Test func libraryShelfAndDeleteMatchTheLibraryActions() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        let library = AudioLibraryStore()
        let pop = try #require(SoundEffectDescriptor.library.first { $0.id == "pop" })
        let swoosh = try #require(SoundEffectDescriptor.library.first { $0.id == "swoosh" })
        let added = try await library.add([try #require(SoundEffectService.shared.bundledURL(for: pop)),
                                           try #require(SoundEffectService.shared.bundledURL(for: swoosh))])
        #expect(added.count == 2)
        ui.audioLibrary = library
        chat.audioLibrary = library

        ui.scrub(to: 1)
        await ui.addSavedAudio(added[0])
        try await chat.chirpy(SavedAudioAddInput(savedAudioID: added[0].id, at: .time(1)))
        #expect(ui.lastReceipt?.action == "editor.audio.addSaved" && ui.lastReceipt?.status == .applied)
        #expect(sameSounds(ui.project, chat.project))

        // Deleting from the library asks only when Chirpy plans it.
        var asked: [AppActionConfirmation] = []
        ui.confirmAssistantAction = { _ in Issue.record("A click is already the creator's decision"); return false }
        chat.confirmAssistantAction = { question in asked.append(question); return true }
        #expect(await ui.removeSavedAudio(added[1]))
        #expect(ui.lastReceipt?.action == "app.audioLibrary.remove")
        let receipt = try await chat.chirpy(SavedAudioRemoveInput(savedAudioID: added[0].id))
        // Still on both timelines, so the library keeps it.
        #expect(receipt.status == .rejected)
        #expect(asked.count == 1)
        #expect(library.items.map(\.id) == [added[0].id])
    }
}
