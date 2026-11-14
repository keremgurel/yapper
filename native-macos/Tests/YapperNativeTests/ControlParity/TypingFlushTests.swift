import Foundation
import Testing
@testable import YapperNative

/// Typing is a preview until its field lets go. Nothing else may act on the
/// project around it: Undo takes the typing back, and every other action,
/// a Chirpy turn and export save it first.
@MainActor
@Suite(.serialized)
struct TypingFlushTests {
    @Test func undoWhileTypingTakesBackTheTypingNotTheEditBeforeIt() async throws {
        let h = try await ControlParityHarness.make()
        let (session, _) = try await h.session()
        defer { h.cleanUp(session) }
        let caption = h.project.captions![1]
        await session.setAspectRatio(.square)
        session.setCaptionText("friends!", for: caption.id)

        await session.undo()
        #expect(session.project.caption(withID: caption.id)?.text == "friends")
        #expect(session.project.selectedAspectRatio == .square)
        #expect(session.typingPreview.isEmpty)

        await session.redo()
        #expect(session.project.caption(withID: caption.id)?.text == "friends!")
        await session.undo()
        await session.undo()
        #expect(session.project.selectedAspectRatio == .source)
    }

    @Test func undoWhileTypingIntoATextLayerTakesBackTheTyping() async throws {
        let h = try await ControlParityHarness.make()
        let (session, _) = try await h.session()
        defer { h.cleanUp(session) }
        let layer = h.project.textLayers![0]
        await session.setAspectRatio(.square)
        session.setTextLayerText("Hook line", for: layer.id)
        await session.undo()
        #expect(session.project.textLayers?.first?.text == "Hook")
        #expect(session.project.selectedAspectRatio == .square)
    }

    @Test func anyOtherActionSavesTypingFirstAsItsOwnStep() async throws {
        let h = try await ControlParityHarness.make()
        let (session, _) = try await h.session()
        defer { h.cleanUp(session) }
        let caption = h.project.captions![1]
        session.setCaptionText("friends!", for: caption.id)
        _ = await session.toggleVideoTrackHidden().value
        let actions = session.appActions.recentResults.map(\.action)
        #expect(actions == ["editor.captions.setText", "editor.project.setSettings"])
        #expect(session.project.caption(withID: caption.id)?.text == "friends!")
        #expect(session.typingPreview.isEmpty)
        await session.undo()
        #expect(session.project.caption(withID: caption.id)?.text == "friends!")
        #expect(!session.project.isVideoTrackHidden)
    }

    @Test func chirpyPlansAgainstWhatWasTyped() async throws {
        let h = try await ControlParityHarness.make()
        let (session, _) = try await h.session()
        defer { h.cleanUp(session) }
        let caption = h.project.captions![1]
        var planned: [String: ActionJSON]?
        session.chirpyPlanner = { payload in
            planned = payload
            return ChirpyPlanReply(message: "Nothing to change.", actions: [])
        }
        session.setCaptionText("friends!", for: caption.id)
        await session.runAssistant(instruction: "how do the captions read?")
        let context = String(decoding: try JSONEncoder().encode(try #require(planned)["context"]), as: UTF8.self)
        #expect(context.contains("friends!"))
        #expect(session.project.caption(withID: caption.id)?.text == "friends!")
    }

    @Test func exportSavesTypingFirst() async throws {
        let h = try await ControlParityHarness.make()
        let (session, _) = try await h.session()
        defer { h.cleanUp(session) }
        let caption = h.project.captions![1]
        session.setCaptionText("friends!", for: caption.id)
        let url = h.root.appending(path: "export.mp4")
        _ = await session.exportForPosting(to: url)
        #expect(session.project.caption(withID: caption.id)?.text == "friends!")
        #expect(session.appActions.recentResults.first?.action == "editor.captions.setText")
    }
}
