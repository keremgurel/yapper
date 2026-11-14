import AppKit
import Foundation
import Testing
@testable import YapperNative

/// The backdrop picker saves what the matching Chirpy plan saves: a swatch
/// through the properties action, Generate through its workflow. A pick is
/// also remembered for the next overlay, so each test puts that back.
@MainActor
@Suite(.serialized)
struct OverlayBackdropParityTests {
    private func picture(in root: URL, named name: String) throws -> URL {
        let bitmap = try #require(NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 9, pixelsHigh: 16, bitsPerSample: 8,
                                                   samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                                                   colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0))
        let url = root.appending(path: name)
        try #require(bitmap.representation(using: .png, properties: [:])).write(to: url)
        return url
    }

    private func backdrop(of overlay: ProjectOverlay, in session: EditorSession) -> OverlayBackdrop? {
        session.project.overlays?.first { $0.id == overlay.id }?.backdrop
    }

    @Test func swatchesMatchThePropertiesAction() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let overlay = h.project.overlays![0]
        let remembered = OverlayBackdropDefault.current
        defer { OverlayBackdropDefault.remember(remembered) }
        ui.setOverlayBackdrop(overlay, to: .preset(.aurora))
        await ui.settleActions(until: 1)
        try await chat.chirpy(OverlayPropertiesInput(backdrop: .preset(.aurora), on: overlay.id))
        #expect(ui.lastReceipt?.action == "editor.overlays.setProperties" && ui.lastReceipt?.status == .applied)
        #expect(backdrop(of: overlay, in: ui) == .preset(.aurora))
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func generateMatchesTheGenerateBackdropWorkflow() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session(), (chat, _) = try await h.session()
        defer { h.cleanUp(ui, chat) }
        let overlay = h.project.overlays![0]
        let url = try picture(in: h.root, named: "Backdrop warm study.png")
        let remembered = OverlayBackdropDefault.current
        defer { OverlayBackdropDefault.remember(remembered) }
        var prompts: [String] = []
        for session in [ui, chat] {
            session.backdropImageGenerator = { prompt in prompts.append(prompt); return url }
        }

        try await ui.generateOverlayBackdrop(overlay, prompt: "warm study")
        let planned = try await chat.chirpy(OverlayBackdropGenerateInput(overlayID: overlay.id, prompt: "warm study"))

        #expect(prompts == ["warm study", "warm study"])
        #expect(ui.lastReceipt?.action == "editor.overlays.generateBackdrop" && ui.lastReceipt?.status == .applied)
        #expect(planned.status == .applied)
        for session in [ui, chat] {
            let imported = try #require(session.project.media.first { $0.isImage })
            #expect(backdrop(of: overlay, in: session) == .image(imported.id))
        }
        // The picture is a fresh ID on each editor; the rest is equal.
        func anonymous(_ session: EditorSession) -> EditorProject {
            var copy = parity(session.project)
            copy.media.removeAll(where: \.isImage)
            copy.overlays = copy.overlays?.map { var overlay = $0; overlay.backdrop?.mediaID = nil; return overlay }
            return copy
        }
        #expect(anonymous(ui) == anonymous(chat))

        // The picture and the backdrop are two edits, the same on both.
        for session in [ui, chat] {
            await session.undo()
            #expect(backdrop(of: overlay, in: session) == nil)
            #expect(session.project.media.contains { $0.isImage })
        }
    }

    @Test func aFailedGenerationSaysWhyAndChangesNothing() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session()
        defer { h.cleanUp(ui) }
        let overlay = h.project.overlays![0]
        ui.backdropImageGenerator = { _ in throw BackdropImageGenerator.Failure(message: "You are out of credits for this month.") }
        let before = parity(ui.project)
        do {
            try await ui.generateOverlayBackdrop(overlay, prompt: "warm study")
            Issue.record("A failed generation has to throw.")
        } catch {
            #expect(error.localizedDescription == "You are out of credits for this month.")
        }
        #expect(ui.lastReceipt?.status == .failed)
        #expect(parity(ui.project) == before)
    }

    @Test func anOverlayDeletedWhileGeneratingGetsNoPicture() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, _) = try await h.session()
        defer { h.cleanUp(ui) }
        let overlay = h.project.overlays![0]
        let url = try picture(in: h.root, named: "Backdrop late.png")
        ui.backdropImageGenerator = { [ui] _ in
            await ui.performAppAction(TimelineDeleteInput(itemIDs: [overlay.id]))
            return url
        }
        await #expect(throws: BackdropImageGenerator.Failure.self) {
            try await ui.generateOverlayBackdrop(overlay, prompt: "warm study")
        }
        #expect(!ui.project.media.contains { $0.isImage })
    }
}
