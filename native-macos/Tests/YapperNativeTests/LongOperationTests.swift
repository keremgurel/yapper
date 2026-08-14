import Foundation
import Testing
@testable import YapperNative

private actor OperationTestStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

@Suite
struct LongOperationTests {
    @Test("Only one long operation can acquire before an await")
    func rejectsOverlap() {
        var coordinator = LongOperationCoordinator()
        let importLease = coordinator.acquire(.importingMedia)
        #expect(importLease != nil)
        #expect(coordinator.acquire(.exporting) == nil)
        #expect(coordinator.active == importLease)
    }

    @Test("A stale release cannot clear a newer operation")
    func staleReleaseIsTokenFenced() throws {
        var coordinator = LongOperationCoordinator()
        let oldValue = coordinator.acquire(.transcribing)
        let old = try #require(oldValue)
        let released = coordinator.release(old)
        #expect(released)
        let currentValue = coordinator.acquire(.exporting)
        let current = try #require(currentValue)
        let staleReleased = coordinator.release(old)
        #expect(!staleReleased)
        #expect(coordinator.active == current)
    }

    @Test("Computed operation categories drive UI flags")
    func categories() {
        #expect(LongOperation.oneClickEdit.isAI)
        #expect(!LongOperation.importingAudio.isAI)
        #expect(LongOperation.exporting.isExport)
        #expect(!LongOperation.relinkingMedia.isExport)
    }

    @Test("Restoration dominates verification while events are coalesced")
    func recoveryDominance() {
        var restored = PendingMediaRecovery.restored
        restored.merge(.verify)
        #expect(restored == .restored)

        var verification = PendingMediaRecovery.verify
        verification.merge(.restored)
        #expect(verification == .restored)
    }

    @Test("Session edit barriers reject ordinary and scheduled mutations while leased")
    @MainActor
    func sessionEditBarrier() async throws {
        let session = EditorSession(store: OperationTestStore())
        let lease = try #require(session.beginLongOperation(.exporting))
        var immediateRan = false
        let committed = await session.commitTimelineEdit(requiresRebuild: false) {
            immediateRan = true
            return true
        }
        var scheduledRan = false
        session.scheduleVisualCommit {
            scheduledRan = true
            return true
        }
        #expect(!committed)
        #expect(!immediateRan)
        #expect(!scheduledRan)
        #expect(session.isBusy)
        #expect(session.isExporting)
        session.endLongOperation(lease)
        #expect(!session.isBusy)
    }

    @Test("Owner commit is allowed and failure releases an import lease")
    @MainActor
    func ownerAndFailureRelease() async throws {
        let session = EditorSession(store: OperationTestStore())
        let lease = try #require(session.beginLongOperation(.importingAudio))
        let committed = await session.commitTimelineEdit(
            requiresRebuild: false,
            owner: lease
        ) {
            session.updateProject { $0.name = "Owned" }
            return true
        }
        #expect(committed)
        session.endLongOperation(lease)

        let invalid = FileManager.default.temporaryDirectory
            .appending(path: "yapper-invalid-operation-\(UUID().uuidString).mov")
        try Data("invalid".utf8).write(to: invalid)
        defer { try? FileManager.default.removeItem(at: invalid) }
        await session.importMedia([invalid])
        #expect(session.activeOperation == nil)
        #expect(!session.isBusy)
    }

    @Test("Pending caption intent runs before coalesced media recovery")
    @MainActor
    func captionThenRecoveryDrain() async throws {
        let session = EditorSession(store: OperationTestStore())
        session.updateProject { project in
            project.clips = [TimelineClip(mediaID: UUID(), sourceStart: 0, sourceEnd: 1)]
            project.captionsEnabled = true
        }
        let held = try #require(session.beginLongOperation(.captions))
        await session.recoverRestoredMedia() // coalesced while the lease is held
        let queuedToggle = Task { @MainActor in await session.toggleCaptions() }
        await Task.yield()

        session.endLongOperation(held)
        await queuedToggle.value
        #expect(session.project.captionsEnabled == false)

        for _ in 0 ..< 50 where session.activeOperation != nil {
            try await Task.sleep(for: .milliseconds(5))
        }
        #expect(session.activeOperation == nil)
    }

    @Test("Tracked assistant transcription cancels without mutation or a false success")
    @MainActor
    func trackedAssistantTranscriptionCancellation() async throws {
        let session = EditorSession(
            store: OperationTestStore(),
            transcriptionRunner: { _, _, progress in
                await progress?(0.25)
                try await Task.sleep(for: .seconds(60))
                return []
            }
        )
        // Let the empty test store finish restoring before installing the fixture.
        await Task.yield()
        let mediaID = UUID()
        let originalWord = TranscriptWord(
            mediaID: mediaID, text: "original", start: 0, end: 0.4
        )
        session.updateProject { project in
            project.media = [ProjectMedia(
                id: mediaID,
                url: URL(fileURLWithPath: "/tmp/cancellable-transcription.mov"),
                name: "Interview",
                duration: 1,
                width: 1920,
                height: 1080,
                hasAudio: true
            )]
            project.clips = [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 1)]
            project.transcript = [originalWord]
        }

        let request = Task { @MainActor in
            await session.runAssistant(instruction: "transcribe my video")
        }
        for _ in 0 ..< 100 where session.activeOperation?.operation != .transcribing {
            await Task.yield()
        }
        #expect(session.hasTrackedTranscription)
        #expect(session.activeOperation?.operation == .transcribing)
        session.cancelCurrentTranscription()
        await request.value

        #expect(session.project.transcript == [originalWord])
        #expect(session.activeOperation == nil)
        #expect(!session.hasTrackedTranscription)
        #expect(session.errorMessage == nil)
        #expect(session.statusMessage == "Transcription canceled")
        #expect(session.conversation.messages.last?.tone == .trouble)
        #expect(session.conversation.messages.last?.text == "Transcription was canceled.")
    }
}
