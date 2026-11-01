import Foundation
import Testing
@testable import YapperNative

/// The end of a drag on the timeline: clip edges, a sound moved or trimmed,
/// an overlay moved or trimmed, and a selection dragged together. Each saves
/// what the matching Chirpy plan saves.
@MainActor
@Suite(.serialized)
struct TimelineDragParityTests {
    @Test func clipEdgeDragsInAndOutMatchTheSourceRangeAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        var trimmed = h.project.clips[1]
        trimmed.sourceStart = 3.4
        await ui.commitClipTrim(trimmed)
        try await chat.chirpy(ClipSourceRangeInput(clipID: trimmed.id, sourceStart: 3.4, sourceEnd: 5))
        #expect(ui.lastReceipt?.action == "editor.clips.setSourceRange" && ui.lastReceipt?.status == .applied)
        #expect(parity(ui.project) == parity(chat.project))

        // Dragging an edge outward reveals more of the recording, which the
        // trim-to-a-time action cannot express.
        var extended = ui.project.clips[1]
        extended.sourceEnd = 5.8
        await ui.commitClipTrim(extended)
        try await chat.chirpy(ClipSourceRangeInput(clipID: extended.id, sourceStart: 3.4, sourceEnd: 5.8))
        #expect(ui.project.clips[1].sourceEnd == 5.8)
        #expect(parity(ui.project) == parity(chat.project))

        var tooFar = ui.project.clips[1]
        tooFar.sourceEnd = 9
        await ui.commitClipTrim(tooFar)
        #expect(ui.lastReceipt?.status == .rejected)
        #expect(ui.project.clips[1].sourceEnd == 5.8)
    }

    @Test func soundDragsMatchTheAudioTrimAction() async throws {
        let h = try await ControlParityHarness.make()
        let effect = try #require(SoundEffectDescriptor.library.first { $0.id == "swoosh" })
        let url = try #require(SoundEffectService.shared.bundledURL(for: effect))
        var project = h.project
        let layer = ProjectAudioLayer(url: url, name: effect.name, timelineStart: 1, duration: 0.4, sourceStart: 0.2,
                                      sourceDuration: effect.duration, builtInID: effect.id, sourceKind: .builtIn)
        project.audioLayers = [layer]
        let (ui, _) = try await h.session(project), (chat, _) = try await h.session(project)
        defer { h.cleanUp(ui, chat) }

        var moved = layer
        moved.timelineStart = 2.25
        await ui.commitAudioTrim(moved)
        try await chat.chirpy(AudioTrimInput(layerIDs: [layer.id], sourceStart: nil, duration: nil, timelineStart: 2.25))
        #expect(ui.lastReceipt?.action == "editor.audio.trim" && ui.lastReceipt?.status == .applied)
        #expect(parity(ui.project) == parity(chat.project))

        // A leading-edge trim moves the in point and the start together.
        var trimmed = ui.project.audioLayers![0]
        trimmed.sourceStart = 0.1
        trimmed.timelineStart = 2.15
        trimmed.duration = 0.5
        await ui.commitAudioTrim(trimmed)
        try await chat.chirpy(AudioTrimInput(layerIDs: [layer.id], sourceStart: 0.1, duration: 0.5, timelineStart: 2.15))
        #expect(ui.project.audioLayers?[0] == trimmed)
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func overlayTimelineDragsMatchThePropertiesAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let overlay = h.project.overlays![0]
        var moved = overlay
        moved.timelineStart = 1.25
        moved.track = 1
        _ = await ui.commitOverlayEdit(moved).value
        try await chat.chirpy(OverlayPropertiesInput(overlayIDs: [overlay.id], all: nil, hidden: nil, behindSpeaker: nil,
                                                     sourceStart: nil, timelineStart: 1.25, duration: nil, track: 1))
        #expect(ui.lastReceipt?.action == "editor.overlays.setProperties" && ui.lastReceipt?.status == .applied)
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func leadingTrimOnAKeyedOverlayKeepsItsKeysWhereTheyWere() async throws {
        let h = try await ControlParityHarness.make()
        var project = h.project
        var keyed = project.overlays![0]
        keyed = OverlayKeyTrack.setting(OverlayBox(x: 0.1, y: 0.1, width: 0.4, height: 0.3), at: 0.2, in: keyed)
        keyed = OverlayKeyTrack.setting(OverlayBox(x: 0.3, y: 0.2, width: 0.5, height: 0.4), at: 1.2, in: keyed)
        project.overlays = [keyed]
        let (ui, _) = try await h.session(project), (chat, _) = try await h.session(project)
        defer { h.cleanUp(ui, chat) }
        // What the timeline's trim handle builds for a leading edge pulled in
        // by half a second.
        let draft = TimelineOverlayGeometry.trimmed(overlay: keyed, edge: .leading, translationX: 50, contentWidth: 600,
                                                    projectDuration: ui.project.duration, sourceDuration: h.video.duration)
        #expect(draft.timelineStart > keyed.timelineStart)
        _ = await ui.commitOverlayEdit(draft).value
        try await chat.chirpy(OverlayPropertiesInput(overlayIDs: [keyed.id], all: nil, hidden: nil, behindSpeaker: nil,
                                                     sourceStart: draft.sourceStart, timelineStart: draft.timelineStart,
                                                     duration: draft.duration, track: nil))
        let saved = try #require(ui.project.overlays?.first)
        #expect(saved.keys == draft.keys)
        #expect(saved.timelineStart == draft.timelineStart && saved.duration == draft.duration)
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func selectionDragReordersAndSlidesAsOneUndoStep() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let first = h.project.clips[0], text = h.project.textLayers![0]
        ui.selectTimelineItem(.clip(first.id))
        ui.selectTimelineItem(.text(text.id), toggling: true)
        ui.timelineDrag.setOffset(0.4, plan: TimelineReorderPlan(insertionIndex: 1, blockDuration: first.duration))
        await ui.commitTimelineSelectionMove()
        let receipts = ui.appActions.recentResults.suffix(2).map(\.action)
        #expect(receipts == ["editor.clips.reorder", "editor.timeline.shift"])

        try await chat.chirpy(ClipReorderInput(clipIDs: [first.id], insertionIndex: 1))
        try await chat.chirpy(TimelineShiftInput(itemIDs: [text.id], deltaSeconds: 0.4))
        #expect(ui.project.clips.map(\.id) == [h.project.clips[1].id, first.id])
        #expect(ui.project.textLayers?.first?.timelineStart == 0.9)
        #expect(parity(ui.project) == parity(chat.project))

        await ui.undo()
        #expect(parity(ui.project) == parity(h.project))
    }
}
