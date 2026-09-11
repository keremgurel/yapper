import Foundation
import Testing
@testable import YapperNative

private actor LockTestStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

@MainActor
struct TimelineLockTests {
    @Test func chatRoutesSpeedAndLockCommandsBeforeCaptionGeneration() {
        #expect(ClipControlCommand.parse("set all clips to 1.5x") == .speed(1.5, all: true))
        #expect(ClipControlCommand.parse("set this clip speed to 0.75×") == .speed(0.75, all: false))
        #expect(ClipControlCommand.parse("lock all captions") == .lock(true, captions: true, all: true))
        #expect(ClipControlCommand.parse("unlock selected clips") == .lock(false, captions: false, all: false))
        #expect(AssistantRouter.route("lock all captions") == .clipControls)
        #expect(AssistantRouter.route("set all clips to 1.5x") == .clipControls)
        #expect(ClipControlCommand.parse("create an overlay about speed") == nil)
    }
    private func fixture() -> EditorProject {
        let id = UUID()
        let words = [TranscriptWord(mediaID: id, text: "one", start: 0.2, end: 0.7),
                     TranscriptWord(mediaID: id, text: "two", start: 1.2, end: 1.7)]
        return EditorProject(clips: [TimelineClip(mediaID: id, sourceStart: 0, sourceEnd: 2)],
            transcript: words, captionsEnabled: true, captions: words.map {
                ProjectCaption(mediaID: id, text: $0.text, sourceStart: $0.start, sourceEnd: $0.end, wordIDs: [$0.id])
            })
    }

    @Test func locksPersistAndBulkCaptionChangesPreserveTextAndAppearance() throws {
        var project = fixture()
        let caption = try #require(project.captions?.first)
        project.setLocked(true, items: [.caption(caption.id)])
        let protected = try #require(project.captions?.first)
        let before = project
        project.applyCaptionStyle(TextStylePatch(fontScale: 0.07), applyToAll: true, selection: [])
        #expect(project.captions?.first == protected)
        #expect(project.captions?.first?.resolvedStyle(base: project.captionStyleOrDefault) == protected.lockedStyle)
        #expect(project.captions?.last?.resolvedStyle(base: project.captionStyleOrDefault).appearance.fontScale == 0.07)
        try project.validateLocks(since: before)
        project.captionWordsPerCard = 1
        project.captions = project.generatedCaptions()
        #expect(project.captions?.contains(protected) == true)
        try project.validateLocks(since: before)
        let restored = try JSONDecoder().decode(EditorProject.self, from: JSONEncoder().encode(project))
        #expect(restored.captions?.first { $0.id == caption.id }?.locked == true)
        #expect(restored.captions?.first { $0.id == caption.id }?.lockedText == "one")
    }

    @Test func lockedClipsRejectTrimsDeletionReorderingAndSpeedChanges() throws {
        var before = fixture()
        let first = before.clips[0]
        before.clips.append(TimelineClip(mediaID: first.mediaID, sourceStart: 2, sourceEnd: 4))
        before.setLocked(true, items: [.clip(first.id)])
        var trimmed = before
        trimmed.clips[0].sourceStart = 0.5
        #expect(throws: (any Error).self) { try trimmed.validateLocks(since: before) }
        var spedUp = before
        spedUp.clips[0].playbackRate = 2
        #expect(throws: (any Error).self) { try spedUp.validateLocks(since: before) }
        var deleted = before
        deleted.clips.removeFirst()
        #expect(throws: (any Error).self) { try deleted.validateLocks(since: before) }
        var reordered = before
        reordered.clips.reverse()
        #expect(throws: (any Error).self) { try reordered.validateLocks(since: before) }
        let framed = ApplyToAll.framing(VideoFraming(scale: 1.2, x: 0, y: 0), to: before.clips)
        #expect(framed[0] == before.clips[0])
        #expect(framed[1] != before.clips[1])
    }

    @Test func clipAndCaptionChangesAreRejectedAtEveryCommitBoundaryUntilUnlocked() async throws {
        let session = EditorSession(store: LockTestStore())
        await Task.yield()
        session.updateProject { $0 = fixture() }
        let clip = try #require(session.project.clips.first)
        let caption = try #require(session.project.captions?.first)
        await session.setTimelineItemsLocked(true, items: [.clip(clip.id), .caption(caption.id)])
        let before = session.project
        let saved = await session.commitTimelineEdit(requiresRebuild: false) {
            session.updateProject { $0.clips[0].sourceEnd = 1 }
            return true
        }
        #expect(!saved)
        #expect(session.project == before)
        session.scheduleVisualCommit {
            session.updateProject { $0.captions?[0].text = "overwritten" }
            return true
        }
        #expect(session.project == before)
        let rollback = try #require(await session.beginPreparedTimelineEdit())
        session.updateProject { $0.clips.removeAll() }
        let preparedSaved = await session.commitPreparedTimelineEdit(rollbackState: rollback, requiresRebuild: false)
        session.endPreparedTimelineEdit()
        #expect(!preparedSaved)
        #expect(session.project == before)
        session.updateProject { $0.captions?.removeAll() }
        await #expect(throws: (any Error).self) { try await session.persist() }
        session.updateProject { $0 = before }
        await session.setTimelineItemsLocked(false, items: [.clip(clip.id), .caption(caption.id)])
        #expect(!session.isLocked(.clip(clip.id)))
        #expect(!session.isLocked(.caption(caption.id)))
        #expect(await session.commitTimelineEdit(requiresRebuild: false) {
            session.updateProject { $0.captions?[0].text = "editable" }
            return true
        })
    }
}
