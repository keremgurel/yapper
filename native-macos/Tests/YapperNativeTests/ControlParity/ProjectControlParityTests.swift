import Foundation
import Testing
@testable import YapperNative

/// Project settings, track toggles, clearing tracks and Undo: each control
/// saves what the Chirpy plan with the same values saves.
@MainActor
@Suite(.serialized)
struct ProjectControlParityTests {
    @Test func aspectRatioMenuMatchesTheSettingsAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, uiStore) = try await h.session(), (chat, chatStore) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        await ui.setAspectRatio(.square)
        try await chat.chirpy(ProjectSettingsInput(aspectRatio: .square))
        #expect(ui.lastReceipt?.action == "editor.project.setSettings" && ui.lastReceipt?.status == .applied)
        #expect(ui.project.selectedAspectRatio == .square)
        #expect(parity(ui.project) == parity(chat.project))
        #expect(await uiStore.saves.map(parity) == chatStore.saves.map(parity))
        #expect(ui.statusMessage == "Frame set to 1:1")
    }

    @Test func filterTileAndStrengthMatchTheSettingsAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        await ui.setVisualFilter(VisualFilter(id: .warm, strength: 1))
        await ui.setVisualFilter(VisualFilter(id: .warm, strength: 0.4))
        try await chat.chirpy(ProjectSettingsInput(filter: .warm, filterStrength: 0.4))
        #expect(ui.lastReceipt?.action == "editor.project.setSettings")
        #expect(ui.project.resolvedVisualFilter == VisualFilter(id: .warm, strength: 0.4))
        #expect(parity(ui.project) == parity(chat.project))
        // Two releases of the strength slider are two Undo steps, not one per
        // pixel of travel.
        await ui.undo()
        #expect(ui.project.resolvedVisualFilter == VisualFilter(id: .warm, strength: 1))
    }

    @Test func videoTrackEyeAndSpeakerMatchTheSettingsAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        ui.toggleVideoTrackHidden()
        await ui.settleActions(until: 1)
        ui.toggleVideoTrackMuted()
        await ui.settleActions(until: 2)
        try await chat.chirpy(ProjectSettingsInput(videoHidden: true))
        try await chat.chirpy(ProjectSettingsInput(videoMuted: true))
        #expect(ui.project.isVideoTrackHidden && ui.project.isVideoTrackMuted)
        #expect(ui.appActions.recentResults.map(\.action) == ["editor.project.setSettings", "editor.project.setSettings"])
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func overlayLaneEyeMatchesTheTrackAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        ui.toggleOverlayTrackHidden(0)
        await ui.settleActions(until: 1)
        try await chat.chirpy(OverlayTrackInput(track: 0, operation: .setHidden, hidden: true))
        #expect(ui.lastReceipt?.action == "editor.overlays.editTrack")
        #expect(ui.isOverlayTrackHidden(0))
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func clearingCaptionsAndTheVideoTrackMatchTheClearAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        await ui.clearAllCaptions()
        try await chat.chirpy(ClearTrackInput(track: .captions))
        #expect(ui.lastReceipt?.action == "editor.timeline.clearTrack")
        #expect(ui.project.storedCaptions.isEmpty)
        #expect(parity(ui.project) == parity(chat.project))
        await ui.clearVideoTrack()
        try await chat.chirpy(ClearTrackInput(track: .video))
        #expect(ui.project.clips.isEmpty)
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func undoAndRedoMenuItemsMatchTheHistoryAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        for session in [ui, chat] { await session.setAspectRatio(.portrait) }
        await ui.undo()
        try await chat.chirpy(HistoryInput(direction: .undo))
        #expect(ui.lastReceipt?.action == "editor.history.restore" && ui.lastReceipt?.status == .applied)
        #expect(ui.project.selectedAspectRatio == .source)
        #expect(parity(ui.project) == parity(chat.project))
        await ui.redo()
        try await chat.chirpy(HistoryInput(direction: .redo))
        #expect(ui.project.selectedAspectRatio == .portrait)
        #expect(parity(ui.project) == parity(chat.project))
    }
}
