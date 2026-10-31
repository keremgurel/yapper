import Foundation
import Testing
@testable import YapperNative

/// The Transcribe, 1-Click Edit and Auto-trim buttons run the workflow
/// actions Chirpy runs, and end with the same project.
@MainActor
@Suite(.serialized)
struct WorkflowControlParityTests {
    private func sessions(_ h: ControlParityHarness, heard words: [TranscriptWord]) async throws -> (EditorSession, EditorSession) {
        var project = h.project
        project.transcript = nil
        project.captions = nil
        project.captionsEnabled = nil
        func make() async throws -> EditorSession {
            let session = EditorSession(store: ControlParityStore(), transcriptionRunner: { _, _, _ in words })
            await Task.yield()
            session.updateProject { $0 = project }
            try await session.rebuildComposition(preserveTime: false)
            return session
        }
        return (try await make(), try await make())
    }

    @Test func transcribeButtonMatchesTheTranscriptionWorkflow() async throws {
        let h = try await ControlParityHarness.make()
        let words = [TranscriptWord(mediaID: h.video.id, text: "hello", start: 0.2, end: 0.6),
                     TranscriptWord(mediaID: h.video.id, text: "again", start: 3.2, end: 3.7)]
        let (ui, chat) = try await sessions(h, heard: words)
        defer { h.cleanUp(ui, chat) }
        ui.startTranscription()
        await ui.settleActions(until: 1)
        try await chat.chirpy(TranscribeWorkflowInput(instruction: "Transcribe the project"))
        #expect(ui.lastReceipt?.action == "editor.transcribe" && ui.lastReceipt?.status == .applied)
        #expect(ui.project.transcript == words)
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func autoTrimButtonMatchesTheSilenceWorkflow() async throws {
        let h = try await ControlParityHarness.make()
        let (ui, chat) = try await sessions(h, heard: [])
        defer { h.cleanUp(ui, chat) }
        await ui.autoTrimSilences(clipIDs: [h.project.clips[0].id])
        try await chat.chirpy(SilenceWorkflowInput(instruction: "Auto-trim silent gaps", clipIDs: [h.project.clips[0].id]))
        #expect(ui.lastReceipt?.action == "editor.trimSilences")
        #expect(ui.lastReceipt?.status == chat.lastReceipt?.status)
        #expect(parity(ui.project) == parity(chat.project))
    }

    @Test func oneClickButtonMatchesTheCleanupWorkflow() async throws {
        let h = try await ControlParityHarness.make()
        let words = [TranscriptWord(mediaID: h.video.id, text: "hello", start: 0.2, end: 0.6)]
        let (ui, chat) = try await sessions(h, heard: words)
        defer { h.cleanUp(ui, chat) }
        // No server in a test, so both runs stop at the cleanup the same way.
        await ui.runOneClickEdit()
        try await chat.chirpy(CleanupWorkflowInput(instruction: "1-Click Edit + Captions"))
        #expect(ui.lastReceipt?.action == "editor.cleanup")
        #expect(ui.lastReceipt?.status == chat.lastReceipt?.status)
        #expect(parity(ui.project) == parity(chat.project))
    }
}
