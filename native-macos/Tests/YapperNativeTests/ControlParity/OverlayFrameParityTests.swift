import Foundation
import Testing
@testable import YapperNative

/// The end of a drag on the canvas, the size slider and Apply to all: each
/// saves through the overlay frame action Chirpy uses.
@MainActor
@Suite(.serialized)
struct OverlayFrameParityTests {
    private func twoOverlays(_ h: ControlParityHarness) -> EditorProject {
        var project = h.project
        project.overlays?.append(ProjectOverlay(mediaID: h.video.id, timelineStart: 2.2, duration: 1, track: 1))
        return project
    }

    @Test func canvasDragOfASelectionMatchesTheFrameAction() async throws {
        let h = try await ControlParityHarness.make()
        let project = twoOverlays(h)
        let (ui, _) = try await h.session(project), (chat, _) = try await h.session(project)
        defer { h.cleanUp(ui, chat) }
        let ids = project.overlays!.map(\.id)
        ui.selectTimelineItem(.overlay(ids[0]))
        ui.selectTimelineItem(.overlay(ids[1]), toggling: true)
        var dragged = project.overlays![0]
        dragged.x = 0.2; dragged.y = 0.3; dragged.width = 0.5; dragged.height = 0.4
        _ = await ui.commitOverlayEdit(dragged).value
        try await chat.chirpy(OverlayFrameInput(overlayIDs: ids, all: nil, fit: nil, x: 0.2, y: 0.3, width: 0.5, height: 0.4,
                                                rotation: 0, time: nil))
        #expect(ui.lastReceipt?.action == "editor.overlays.setFrame" && ui.lastReceipt?.status == .applied)
        #expect(ui.project.overlays?.allSatisfy { $0.x == 0.2 && $0.width == 0.5 } == true)
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func dragOnAKeyedOverlayWritesAKeyAtThePlayhead() async throws {
        let h = try await ControlParityHarness.make()
        var project = h.project
        var keyed = project.overlays![0]
        keyed = OverlayKeyTrack.setting(OverlayBox(x: 0.1, y: 0.1, width: 0.4, height: 0.3), at: 0.2, in: keyed)
        project.overlays = [keyed]
        let (ui, _) = try await h.session(project), (chat, _) = try await h.session(project)
        defer { h.cleanUp(ui, chat) }
        ui.scrub(to: 1.5)
        var dragged = ui.displayedOverlay(keyed)
        dragged.x = 0.35; dragged.y = 0.25
        _ = await ui.commitOverlayEdit(dragged).value
        try await chat.chirpy(OverlayFrameInput(overlayIDs: [keyed.id], all: nil, fit: nil, x: 0.35, y: 0.25,
                                                width: dragged.width, height: dragged.height, rotation: nil, time: 1))
        #expect(ui.lastReceipt?.action == "editor.overlays.setFrame")
        #expect(OverlayKeyTrack.keys(of: ui.project.overlays![0]).count == 2)
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func sizeSliderAndApplyToAllMatchTheFrameAction() async throws {
        let h = try await ControlParityHarness.make()
        let project = twoOverlays(h)
        let (ui, _) = try await h.session(project), (chat, _) = try await h.session(project)
        defer { h.cleanUp(ui, chat) }
        let overlay = project.overlays![0]
        ui.previewOverlayScale(overlay, toWidth: 0.6)
        // The slider previews on the canvas and saves nothing until released.
        #expect(parity(ui.project) == parity(project))
        await ui.scaleOverlay(overlay, toWidth: 0.6)
        #expect(ui.canvasDrag.overlayDraft(for: overlay.id) == nil)
        let scaled = try #require(ui.project.overlays?.first)
        try await chat.chirpy(OverlayFrameInput(overlayIDs: [overlay.id], all: nil, fit: nil, x: scaled.x, y: scaled.y,
                                                width: scaled.width, height: scaled.height, rotation: 0, time: nil))
        #expect(scaled.width == 0.6)
        #expect(parity(ui.project) == parity(chat.project))

        ui.applyOverlayFrame(of: scaled, scope: .project)
        await ui.settleActions(until: 2)
        try await chat.chirpy(OverlayFrameInput(overlayIDs: [project.overlays![1].id], all: nil, fit: nil, x: scaled.x, y: scaled.y,
                                                width: scaled.width, height: scaled.height, rotation: 0, time: nil))
        #expect(ui.project.overlays?.last?.width == 0.6)
        #expect(parity(ui.project) == parity(chat.project))
        #expect(ui.statusMessage.hasPrefix("Size and position applied to 1 overlay"))
    }
}
