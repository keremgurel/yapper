@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

private actor TestProjectStore: ProjectPersisting {
    enum Failure: LocalizedError {
        case diskFull
        case unreadable

        var errorDescription: String? {
            switch self {
            case .diskFull: "The test disk is full."
            case .unreadable: "The saved project is unreadable."
            }
        }
    }

    var loadedProject: EditorProject?
    var loadFailure: Failure?
    var saveFailure: Failure?
    private(set) var saveAttempts = 0
    private(set) var savedProjects: [EditorProject] = []

    init(
        loadedProject: EditorProject? = nil,
        loadFailure: Failure? = nil,
        saveFailure: Failure? = nil
    ) {
        self.loadedProject = loadedProject
        self.loadFailure = loadFailure
        self.saveFailure = saveFailure
    }

    func load() async throws -> EditorProject? {
        if let loadFailure { throw loadFailure }
        return loadedProject
    }

    func save(_ project: EditorProject) async throws {
        saveAttempts += 1
        if let saveFailure { throw saveFailure }
        savedProjects.append(project)
    }

    func snapshot() -> (attempts: Int, projects: [EditorProject]) {
        (saveAttempts, savedProjects)
    }

    func setSaveFailure(_ failure: Failure?) {
        saveFailure = failure
    }
}

@Suite(.serialized)
@MainActor
struct PersistenceFailureTests {
    @Test("Persistence propagates the storage error")
    func persistPropagatesFailure() async {
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)

        var receivedFailure: TestProjectStore.Failure?
        do {
            try await session.persist()
        } catch let failure as TestProjectStore.Failure {
            receivedFailure = failure
        } catch {
            Issue.record("Unexpected error: \(error)")
        }

        #expect(receivedFailure == .diskFull)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
        #expect(saved.projects.isEmpty)
    }

    @Test("A failed UI save is never announced or recorded as committed")
    func failedChangeStaysVisible() async {
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)
        let before = session.project
        session.updateProject { $0.name = "Unsaved title" }

        await session.persistChange(undoSnapshot: before, successStatus: "Saved")

        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        #expect(!session.canUndo)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
        #expect(saved.projects.isEmpty)
    }

    @Test("A successful UI save records history and announces success")
    func successfulChangeCommits() async {
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let before = session.project
        session.updateProject { $0.name = "Durable title" }

        await session.persistChange(undoSnapshot: before, successStatus: "Saved")

        #expect(session.statusMessage == "Saved")
        #expect(session.errorMessage == nil)
        #expect(session.canUndo)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
        #expect(saved.projects.map(\.name) == ["Durable title"])
    }

    @Test("A debounced visual save cannot overwrite its storage failure with Ready")
    func debouncedFailureStaysVisible() async throws {
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)

        session.scheduleVisualCommit(undoSnapshot: session.project)
        try await Task.sleep(for: .milliseconds(250))

        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        #expect(!session.canUndo)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
    }

    @Test("A timeline commit cannot report Ready after storage fails")
    func timelineCommitFailureStaysVisible() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)
        let project = try await videoProject(in: directory, name: "Unsaved edit")
        session.updateProject { $0 = project }

        await session.commitTimelineEdit(undoSnapshot: EditorProject())

        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        #expect(!session.canUndo)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
        #expect(saved.projects.isEmpty)
    }

    @Test("Recovery still persists a project with no timeline clips")
    func emptyTimelineRecoveryPropagatesSaveFailure() async {
        let store = TestProjectStore(saveFailure: .diskFull)
        let session = EditorSession(store: store)

        var receivedFailure: TestProjectStore.Failure?
        do {
            try await session.reloadAfterRecovery()
        } catch let failure as TestProjectStore.Failure {
            receivedFailure = failure
        } catch {
            Issue.record("Unexpected error: \(error)")
        }

        #expect(receivedFailure == .diskFull)
        let saved = await store.snapshot()
        #expect(saved.attempts == 1)
    }

    @Test("A failed undo restores the live project and keeps the undo available")
    func failedUndoRestoresHistory() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let original = try await videoProject(in: directory, name: "Original", sourceEnd: 0.45)
        session.updateProject { $0 = original }
        await session.commitTimelineEdit()
        let committedOriginal = session.project
        session.updateProject {
            $0.name = "Current"
            $0.clips[0].sourceEnd = 0.9
        }
        await session.commitTimelineEdit(undoSnapshot: committedOriginal)
        session.seekToTimelineTime(0.8)
        #expect(session.canUndo)
        #expect(abs(try await playerDuration(session) - 0.9) < 0.05)
        await store.setSaveFailure(.diskFull)

        await session.undo()

        #expect(session.project.name == "Current")
        #expect(abs(session.project.duration - 0.9) < 0.001)
        #expect(abs(session.currentTime - 0.8) < 0.05)
        #expect(abs(try await playerDuration(session) - 0.9) < 0.05)
        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        #expect(session.canUndo)
        #expect(!session.canRedo)
    }

    @Test("A failed undo back to an empty project clears the player again")
    func failedUndoRestoresEmptyPlayer() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let nonempty = try await videoProject(in: directory, name: "Footage")
        session.updateProject { $0 = nonempty }
        await session.commitTimelineEdit()
        session.updateProject { $0 = EditorProject(name: "Empty") }
        await session.commitTimelineEdit(undoSnapshot: nonempty)
        #expect(session.player.currentItem == nil)
        await store.setSaveFailure(.diskFull)

        await session.undo()

        #expect(session.project.clips.isEmpty)
        #expect(session.player.currentItem == nil)
        #expect(session.statusMessage == "Needs attention")
        #expect(session.canUndo)
    }

    @Test("A failed auto-trim restores both the project and the live composition")
    func failedAutoTrimRestoresPlayer() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = TestProjectStore()
        let session = EditorSession(store: store)
        let project = try await videoProject(
            in: directory,
            name: "Untrimmed",
            sourceEnd: 0.9,
            transcriptRanges: [(0.2, 0.3), (0.7, 0.8)]
        )
        var splitProject = project
        splitProject.clips = [
            TimelineClip(mediaID: project.media[0].id, sourceStart: 0, sourceEnd: 0.45),
            TimelineClip(mediaID: project.media[0].id, sourceStart: 0.45, sourceEnd: 0.9),
        ]
        session.updateProject { $0 = splitProject }
        await session.commitTimelineEdit()
        let before = session.project
        let selected = before.clips[1].id
        session.selectTimelineItem(.clip(selected))
        session.seekToTimelineTime(0.75)
        #expect(abs(try await playerDuration(session) - before.duration) < 0.05)
        await store.setSaveFailure(.diskFull)

        await session.autoTrimSilences()

        #expect(session.project == before)
        #expect(session.selectedClipID == selected)
        #expect(session.timelineSelection == [.clip(selected)])
        #expect(abs(session.currentTime - 0.75) < 0.05)
        #expect(abs(try await playerDuration(session) - before.duration) < 0.05)
        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The test disk is full.")
        #expect(!session.canUndo)
    }

    @Test("Restore failures come from the injected store and stay visible")
    func restoreFailureIsReported() async throws {
        let store = TestProjectStore(loadFailure: .unreadable)
        let session = EditorSession(store: store)

        try await Task.sleep(for: .milliseconds(50))

        #expect(session.statusMessage == "Needs attention")
        #expect(session.errorMessage == "The saved project is unreadable.")
    }

    private func videoProject(
        in directory: URL,
        name: String,
        sourceEnd: Double = 0.9,
        transcriptRanges: [(Double, Double)] = []
    ) async throws -> EditorProject {
        let source = directory.appending(path: "source.mov")
        try await SyntheticVideo.write(
            color: CGColor(red: 0.2, green: 0.3, blue: 0.4, alpha: 1),
            size: CGSize(width: 320, height: 180),
            to: source
        )
        let media = try await MediaProbe.inspect(url: source)
        return EditorProject(
            name: name,
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: sourceEnd)],
            transcript: transcriptRanges.enumerated().map { index, range in
                TranscriptWord(
                    mediaID: media.id,
                    text: "word\(index)",
                    start: range.0,
                    end: range.1
                )
            }
        )
    }

    private func playerDuration(_ session: EditorSession) async throws -> Double {
        guard let asset = session.player.currentItem?.asset else {
            throw TestProjectStore.Failure.unreadable
        }
        return try await asset.load(.duration).seconds
    }

    private func temporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-persistence-tests-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}
