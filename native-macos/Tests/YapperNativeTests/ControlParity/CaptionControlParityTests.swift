import Foundation
import Testing
@testable import YapperNative

/// Typing into a caption or a text layer, splitting a caption, pasting a look
/// and the caption buttons save what the matching Chirpy plan saves.
@MainActor
@Suite(.serialized)
struct CaptionControlParityTests {
    @Test func typingIsAPreviewUntilEditingEndsThenOneTextAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, uiStore) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let caption = h.project.captions![1]
        for typed in ["f", "fr", "fri", "friends!"] { ui.setCaptionText(typed, for: caption.id) }
        // Keystrokes reach the canvas, not the project or the disk.
        #expect(ui.typingPreview.captionText[caption.id] == "friends!")
        #expect(ui.project.caption(withID: caption.id)?.text == "friends")
        #expect(await uiStore.saves.isEmpty)

        await ui.commitCaptionText(for: caption.id)
        try await chat.chirpy(CaptionTextInput(captionID: caption.id, text: "friends!"))
        #expect(ui.lastReceipt?.action == "editor.captions.setText" && ui.lastReceipt?.status == .applied)
        #expect(ui.typingPreview.captionText.isEmpty)
        #expect(parity(ui.project) == parity(chat.project))
        // The whole edit is one Undo step.
        await ui.undo()
        #expect(ui.project.caption(withID: caption.id)?.text == "friends")
    }

    @Test func emptyingACaptionRemovesItThroughTheRemoveAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let caption = h.project.captions![1]
        ui.setCaptionText(" ", for: caption.id)
        await ui.commitCaptionText(for: caption.id)
        try await chat.chirpy(CaptionRemoveInput(captionIDs: [caption.id]))
        #expect(ui.lastReceipt?.action == "editor.captions.remove")
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func typingIntoATextLayerCommitsOnceThroughTheUpdateAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let layer = h.project.textLayers![0]
        for typed in ["Hook ", "Hook l", "Hook line"] { ui.setTextLayerText(typed, for: layer.id) }
        #expect(ui.project.textLayers?.first?.text == "Hook")
        await ui.commitTextLayerText(for: layer.id)
        try await chat.chirpy(TextLayerUpdateInput(textLayerID: layer.id, text: "Hook line", timelineStart: nil, duration: nil))
        #expect(ui.lastReceipt?.action == "editor.text.update")
        #expect(parity(ui.project) == parity(chat.project))
        await ui.undo()
        #expect(ui.project.textLayers?.first?.text == "Hook")
    }

    @Test func enterInACaptionRowMatchesTheSplitAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let caption = h.project.captions![0]
        let tail = await ui.splitCaption(caption.id, afterWords: 1)
        let receipt = try await chat.chirpy(CaptionSplitInput(captionID: caption.id, afterWords: 1))
        #expect(ui.lastReceipt?.action == "editor.captions.splitAtWord")
        #expect(tail != nil && ui.selectedCaptionIDs == [tail!])
        // Each side mints the new card's ID; the text and timing match.
        let chatTail = try #require(receipt.changes.first.flatMap { UUID(uuidString: $0.after) })
        #expect(ui.project.caption(withID: tail!)?.text == chat.project.caption(withID: chatTail)?.text)
        #expect(ui.project.caption(withID: caption.id) == chat.project.caption(withID: caption.id))
    }

    @Test func pastePropertiesMatchesThePasteAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let cards = h.project.captions!
        for session in [ui, chat] {
            session.setSelectedCaptionIDs([cards[0].id])
            _ = await session.setCaptionStyle(TextStylePatch(x: 0.2, y: 0.3)).value
        }
        ui.copyProperties(of: .caption(cards[0].id))
        _ = await ui.pasteProperties(onto: .caption(cards[1].id)).value
        // Chirpy copies and pastes in one call.
        try await chat.chirpy(PropertiesPasteInput(itemIDs: [cards[1].id], fromItemID: cards[0].id))
        #expect(ui.lastReceipt?.action == "editor.properties.paste" && ui.lastReceipt?.status == .applied)
        #expect(ui.captions[1].overrides.x == 0.2)
        #expect(parity(ui.project) == parity(chat.project))

        let refused = try await chat.chirpy(PropertiesPasteInput(itemIDs: [h.project.overlays![0].id], fromItemID: nil))
        #expect(refused.status == .rejected)
    }

    @Test func captionButtonsMatchTheVisibilityAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        await ui.toggleCaptions()
        try await chat.chirpy(CaptionVisibilityInput(visible: false))
        #expect(ui.lastReceipt?.action == "editor.captions.setVisible")
        #expect(ui.project.captionsEnabled != true)
        #expect(parity(ui.project) == parity(chat.project))

        // Regenerate rebuilds every card from the transcript, discarding hand edits.
        for session in [ui, chat] { await session.performAppAction(CaptionTextInput(captionID: h.project.captions![1].id, text: "edited")) }
        await ui.generateCaptions()
        try await chat.chirpy(CaptionVisibilityInput(visible: true, regenerate: true))
        #expect(ui.lastReceipt?.action == "editor.captions.setVisible" && ui.lastReceipt?.status == .applied)
        #expect(ui.project.captionsEnabled == true)
        #expect(!ui.project.storedCaptions.contains { $0.text == "edited" })
        #expect(ui.project.storedCaptions.map(\.text) == chat.project.storedCaptions.map(\.text))
    }
}
