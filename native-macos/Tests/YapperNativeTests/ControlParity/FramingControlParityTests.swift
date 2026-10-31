import Foundation
import Testing
@testable import YapperNative

/// The framing diamond, its timeline markers, a finished framing gesture and
/// the retouch sliders save what the matching Chirpy plan saves.
@MainActor
@Suite(.serialized)
struct FramingControlParityTests {
    @Test func diamondMarkersAndClearMatchTheKeyframeAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let clip = h.project.clips[0]
        ui.scrub(to: 1)
        ui.toggleFramingKey()
        await ui.settleActions(until: 1)
        try await chat.chirpy(VideoFramingKeyInput(clipID: clip.id, sourceTime: 1, operation: .set, destination: nil,
                                                   scale: 1, x: 0, y: 0, rotation: 0))
        #expect(ui.lastReceipt?.action == "editor.video.framingKey" && ui.lastReceipt?.status == .applied)
        #expect(ui.framingKeys.count == 1)
        #expect(parity(ui.project) == parity(chat.project))

        ui.removeFramingKey(in: ui.project.clips[0], atSource: 1)
        await ui.settleActions(until: 2)
        try await chat.chirpy(VideoFramingKeyInput(clipID: clip.id, sourceTime: 1, operation: .remove, destination: nil,
                                                   scale: nil, x: nil, y: nil, rotation: nil))
        #expect(parity(ui.project) == parity(chat.project))

        for session in [ui, chat] {
            session.scrub(to: 0.5)
            session.toggleFramingKey()
            await session.settleActions(until: session.appActions.recentResults.count + 1)
        }
        ui.clearFramingKeys()
        await ui.settleActions(until: 4)
        try await chat.chirpy(VideoFramingKeyInput(clipID: clip.id, sourceTime: 0.5, operation: .clear, destination: nil,
                                                   scale: nil, x: nil, y: nil, rotation: nil))
        #expect(ui.framingKeys.isEmpty)
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func framingGestureMatchesTheFramingActions() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let clip = h.project.clips[0]
        let framing = VideoFraming(scale: 1.5, x: 0.1, y: -0.05)
        ui.commitFraming(framing, clipID: clip.id)
        await ui.settleActions(until: 1)
        try await chat.chirpy(VideoFramingInput(clipIDs: [clip.id], scale: 1.5, x: 0.1, y: -0.05, rotation: 0))
        #expect(ui.lastReceipt?.action == "editor.video.setFraming")
        #expect(ui.project.clips[0].resolvedFraming == framing)
        #expect(parity(ui.project) == parity(chat.project))

        // On a keyed clip the same gesture writes a key at the playhead.
        for session in [ui, chat] {
            session.scrub(to: 0.4)
            session.toggleFramingKey()
            await session.settleActions(until: session.appActions.recentResults.count + 1)
            session.scrub(to: 1.2)
        }
        let pushed = VideoFraming(scale: 2, x: 0, y: 0)
        ui.commitFraming(pushed, clipID: clip.id)
        await ui.settleActions(until: 3)
        try await chat.chirpy(VideoFramingKeyInput(clipID: clip.id, sourceTime: 1.2, operation: .set, destination: nil,
                                                   scale: 2, x: 0, y: 0, rotation: 0))
        #expect(ui.lastReceipt?.action == "editor.video.framingKey")
        #expect(ui.framingKeys.count == 2)
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func retouchSlidersCommitTheReleasedValueThroughTheRetouchAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let clip = h.project.clips[0]
        await ui.setClearBlemishes(0.6)
        await ui.setWhitenTeeth(0.3)
        try await chat.chirpy(ClipRetouchInput(clipIDs: [clip.id], clearBlemishes: 0.6, whitenTeeth: nil))
        try await chat.chirpy(ClipRetouchInput(clipIDs: [clip.id], clearBlemishes: nil, whitenTeeth: 0.3))
        #expect(ui.appActions.recentResults.map(\.action) == ["editor.retouch.set", "editor.retouch.set"])
        #expect(ui.retouch == ClipRetouch(clearBlemishes: 0.6, whitenTeeth: 0.3))
        #expect(parity(ui.project) == parity(chat.project))
    }
}
