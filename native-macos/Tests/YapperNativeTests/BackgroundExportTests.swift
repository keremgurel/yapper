import Foundation
import Testing
@testable import YapperNative

/// The editor side of a background export: what it captures when the job
/// starts, and that switching projects neither stops the job nor locks the
/// project that is open next.
@Suite(.serialized)
@MainActor
struct BackgroundExportTests {
    @Test("An export renders the project as it was when it started, and edits go on meanwhile")
    func rendersTheStartingSnapshot() async throws {
        let fixture = try ExportFixture()
        defer { fixture.remove() }
        let runner = GatedExportRunner()
        let session = EditorSession(store: MemoryProjectStore(), exportRunner: runner.run)
        await Task.yield()
        fixture.load(into: session, named: "First cut")

        let id = try #require(await session.export(to: fixture.destination))
        try await eventually { await runner.startedCount() == 1 }
        #expect(session.activeOperation == nil)
        #expect(!session.isBusy)

        let edited = await session.commitTimelineEdit(requiresRebuild: false) {
            session.updateProject { project in
                project.name = "Second cut"
                project.clips[0].sourceEnd = 0.5
            }
            return true
        }
        #expect(edited)
        #expect(session.project.name == "Second cut")

        await runner.release()
        let finished = try #require(await session.exportJobs.completion(of: id))
        let rendered = try #require(await runner.projects().first)
        #expect(finished.state == .finished(.file(fixture.destination)))
        #expect(rendered.name == "First cut")
        #expect(rendered.clips[0].sourceEnd == 1)
        #expect(try String(contentsOf: fixture.destination, encoding: .utf8) == "rendered First cut")
    }

    @Test("Opening another project keeps the export running and leaves the new project editable")
    func survivesProjectSwitch() async throws {
        let fixture = try ExportFixture()
        defer { fixture.remove() }
        let runner = GatedExportRunner()
        let session = EditorSession(store: MemoryProjectStore(), exportRunner: runner.run)
        await Task.yield()
        await session.openProject(ProjectPackage(url: fixture.directory.appending(path: "Talk.yapperproj")))
        fixture.load(into: session, named: "Talk")
        let exportedID = session.project.id

        let id = try #require(await session.export(to: fixture.destination))
        try await eventually { session.exportJobs.job(id)?.state == .rendering(0.4) }

        await session.openProject(ProjectPackage(url: fixture.directory.appending(path: "Next idea.yapperproj")))
        #expect(session.project.name == "Next idea")
        #expect(session.project.id != exportedID)
        #expect(session.exportJobs.job(id)?.state == .rendering(0.4))
        #expect(session.activeOperation == nil)

        let edited = await session.commitTimelineEdit(requiresRebuild: false) {
            session.updateProject { $0.name = "Next idea, renamed" }
            return true
        }
        #expect(edited)
        #expect(session.canUndo)

        await runner.release()
        let finished = try #require(await session.exportJobs.completion(of: id))
        #expect(finished.state == .finished(.file(fixture.destination)))
        #expect(finished.projectName == "Talk")
        #expect(await runner.projects().first?.id == exportedID)
        // The result belongs to the indicator, not to the project now open.
        #expect(session.lastExportURL == nil)
        #expect(session.statusMessage != "Exported \(fixture.destination.lastPathComponent)")
        #expect(session.exportJobs.jobs.map(\.id) == [id])
    }

    @Test("Finishing on the same project says where the file landed")
    func reportsToTheProjectStillOpen() async throws {
        let fixture = try ExportFixture()
        defer { fixture.remove() }
        let runner = GatedExportRunner()
        let session = EditorSession(store: MemoryProjectStore(), exportRunner: runner.run)
        await Task.yield()
        fixture.load(into: session, named: "Same project")

        let id = try #require(await session.export(to: fixture.destination))
        #expect(session.statusMessage == "Exporting in the background")
        await runner.release()
        _ = await session.exportJobs.completion(of: id)

        #expect(session.lastExportURL == fixture.destination)
        #expect(session.statusMessage == "Exported \(fixture.destination.lastPathComponent)")
        #expect(session.errorMessage == nil)
    }

    @Test("Canceling stops the render, keeps the existing file, and drops the job")
    func cancelKeepsDestination() async throws {
        let fixture = try ExportFixture()
        defer { fixture.remove() }
        try Data("keep me".utf8).write(to: fixture.destination)
        let runner = GatedExportRunner()
        let session = EditorSession(store: MemoryProjectStore(), exportRunner: runner.run)
        await Task.yield()
        fixture.load(into: session, named: "Canceled")

        let id = try #require(await session.export(to: fixture.destination))
        try await eventually { await runner.startedCount() == 1 }
        session.exportJobs.cancel(id)
        let ended = try #require(await session.exportJobs.completion(of: id))

        #expect(ended.state == .canceled)
        #expect(session.exportJobs.jobs.isEmpty)
        #expect(await runner.cancellationCount() == 1)
        #expect(try Data(contentsOf: fixture.destination) == Data("keep me".utf8))
        #expect(session.statusMessage == "Export canceled")
        #expect(session.errorMessage == nil)
    }

    @Test("Two exports run at once, but never to the same file")
    func concurrentExports() async throws {
        let fixture = try ExportFixture()
        defer { fixture.remove() }
        let runner = GatedExportRunner()
        let session = EditorSession(store: MemoryProjectStore(), exportRunner: runner.run)
        await Task.yield()
        fixture.load(into: session, named: "Twice")

        let first = try #require(await session.export(to: fixture.destination))
        #expect(await session.export(to: fixture.destination) == nil)
        #expect(session.statusMessage == "That file is still exporting. Choose another name.")

        let otherDestination = fixture.directory.appending(path: "vertical.mp4")
        let second = try #require(await session.export(to: otherDestination))
        try await eventually { await runner.startedCount() == 2 }
        #expect(session.exportJobs.runningJobs.count == 2)

        await runner.release()
        #expect(await session.exportJobs.completion(of: first)?.state == .finished(.file(fixture.destination)))
        #expect(await session.exportJobs.completion(of: second)?.state == .finished(.file(otherDestination)))
    }

    @Test("A failed render reports on the job and on the project that is still open")
    func failureIsReported() async throws {
        let fixture = try ExportFixture()
        defer { fixture.remove() }
        let session = EditorSession(store: MemoryProjectStore(), exportRunner: { _, _, _ in
            throw NativeEditorError.exportFailed("The disk is full.")
        })
        await Task.yield()
        fixture.load(into: session, named: "Broken")

        let id = try #require(await session.export(to: fixture.destination))
        let ended = try #require(await session.exportJobs.completion(of: id))

        #expect(ended.state == .failed("Export failed: The disk is full."))
        #expect(session.errorMessage == "Export failed: The disk is full.")
        #expect(!FileManager.default.fileExists(atPath: fixture.destination.path))
    }

    @Test("An export does not start while another editor operation holds the project")
    func waitsForEditorOperations() async throws {
        let fixture = try ExportFixture()
        defer { fixture.remove() }
        let runner = GatedExportRunner()
        let session = EditorSession(store: MemoryProjectStore(), exportRunner: runner.run)
        await Task.yield()
        fixture.load(into: session, named: "Busy")
        let lease = try #require(session.beginLongOperation(.autoTrim))

        #expect(await session.export(to: fixture.destination) == nil)
        #expect(session.statusMessage == "Wait for auto-trim to finish. Then export.")
        #expect(session.exportJobs.jobs.isEmpty)
        #expect(await runner.startedCount() == 0)
        session.endLongOperation(lease)
    }

    @Test("Opening another project while an export is being captured exports nothing")
    func projectSwitchDuringCapture() async throws {
        let fixture = try ExportFixture()
        defer { fixture.remove() }
        let runner = GatedExportRunner()
        let session = EditorSession(store: MemoryProjectStore(), exportRunner: runner.run)
        await Task.yield()
        await session.openProject(ProjectPackage(url: fixture.directory.appending(path: "Talk.yapperproj")))
        fixture.load(into: session, named: "Talk")

        // A trim still saving holds the edit slot, so the capture waits.
        _ = try #require(await session.beginPreparedTimelineEdit())
        let export = Task { @MainActor in await session.export(to: fixture.destination) }
        try await Task.sleep(for: .milliseconds(50))
        await session.openProject(ProjectPackage(url: fixture.directory.appending(path: "Next idea.yapperproj")))
        session.endPreparedTimelineEdit()
        let id = await export.value

        #expect(id == nil)
        #expect(session.exportJobs.jobs.isEmpty)
        #expect(await runner.startedCount() == 0)
        #expect(session.statusMessage == "Nothing was exported because the project changed while the export was starting. Export again.")
        #expect(!session.exportJobs.isExporting(to: fixture.destination))
    }

    @Test("A second export to the same file is refused while the first is still being captured")
    func sameFileDuringCapture() async throws {
        let fixture = try ExportFixture()
        defer { fixture.remove() }
        let runner = GatedExportRunner()
        let session = EditorSession(store: MemoryProjectStore(), exportRunner: runner.run)
        await Task.yield()
        fixture.load(into: session, named: "Twice")

        _ = try #require(await session.beginPreparedTimelineEdit())
        let first = Task { @MainActor in await session.export(to: fixture.destination) }
        try await Task.sleep(for: .milliseconds(50))
        // Same file: another case, and the folder reached through a symlink.
        let folder = fixture.directory.path
        let otherSpelling = folder.hasPrefix("/private/") ? String(folder.dropFirst("/private".count)) : "/private" + folder
        let sameFile = URL(filePath: otherSpelling, directoryHint: .isDirectory).appending(path: "EXPORT.MP4")
        // Its own task: without the claim it would queue behind the edit slot
        // this test holds, and the test would hang instead of failing.
        let second = Task { @MainActor in await session.export(to: sameFile) }
        try await eventually { session.statusMessage == "That file is still exporting. Choose another name." }
        session.endPreparedTimelineEdit()
        #expect(await second.value == nil)

        let id = try #require(await first.value)
        await runner.release()
        #expect(await session.exportJobs.completion(of: id)?.state == .finished(.file(fixture.destination)))
        #expect(await runner.startedCount() == 1)
    }

    @Test("Renaming or trashing a project is refused while an export copies its footage")
    func moveGuardsWhilePreparing() async throws {
        let fixture = try ExportFixture()
        defer { fixture.remove() }
        let runner = PreparingExportRunner()
        let session = EditorSession(store: MemoryProjectStore(), exportRunner: runner.run)
        await Task.yield()
        let package = ProjectPackage(url: fixture.directory.appending(path: "Talk.yapperproj"))
        await session.openProject(package)
        fixture.load(into: session, named: "Talk")

        let id = try #require(await session.export(to: fixture.destination))
        try await eventually { await runner.startedCount() == 1 }
        #expect(session.exportJobs.job(id)?.state == .preparing)

        await session.renameCurrentProject(to: "Renamed talk")
        #expect(session.statusMessage == EditorSession.renameRefusal)
        #expect(session.projectNavigation.currentPackage == package)

        await session.trashProject(package)
        #expect(session.statusMessage == EditorSession.trashRefusal)
        #expect(session.projectNavigation.currentPackage == package)
        #expect(FileManager.default.fileExists(atPath: package.url.path))

        await runner.release()
        _ = await session.exportJobs.completion(of: id)
        // A rename moves the package into the library folder, which a test run
        // only has once some test has created it.
        try FileManager.default.createDirectory(at: session.library.directory, withIntermediateDirectories: true)
        await session.renameCurrentProject(to: "Renamed talk")
        let renamed = try #require(session.projectNavigation.currentPackage)
        defer { try? FileManager.default.removeItem(at: renamed.url) }
        #expect(renamed.displayName == "Renamed talk")
    }
}

/// A source file and a destination in a private folder, plus the one-clip
/// project that uses them.
private struct ExportFixture {
    let directory: URL
    let source: URL
    let destination: URL

    init() throws {
        directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-background-export-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        source = directory.appending(path: "source.mov")
        destination = directory.appending(path: "export.mp4")
        try Data("source".utf8).write(to: source)
    }

    @MainActor
    func load(into session: EditorSession, named name: String) {
        let mediaID = UUID()
        session.updateProject { project in
            project.name = name
            project.media = [ProjectMedia(
                id: mediaID, url: source, name: "Source",
                duration: 1, width: 1920, height: 1080, hasAudio: true
            )]
            project.clips = [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 1)]
        }
    }

    func remove() {
        try? FileManager.default.removeItem(at: directory)
    }
}

private actor MemoryProjectStore: ProjectPersisting {
    private var saved: EditorProject?
    func load() async throws -> EditorProject? { saved }
    func save(_ project: EditorProject) async throws { saved = project }
}

/// Starts like a real export (progress at 0, then 40%), then holds until the
/// test lets it finish or cancels it.
private actor GatedExportRunner {
    private var started: [EditorProject] = []
    private var cancellations = 0
    private var released = false

    nonisolated var run: NativeExportRunner {
        { project, url, progress in try await self.render(project, to: url, progress: progress) }
    }

    func render(_ project: EditorProject, to url: URL, progress: ExportProgressHandler) async throws {
        started.append(project)
        progress(0)
        progress(0.4)
        do {
            while !released { try await Task.sleep(for: .milliseconds(5)) }
        } catch {
            cancellations += 1
            throw error
        }
        try Data("rendered \(project.name)".utf8).write(to: url)
        progress(1)
    }

    func release() { released = true }
    func startedCount() -> Int { started.count }
    func projects() -> [EditorProject] { started }
    func cancellationCount() -> Int { cancellations }
}

/// Holds the job in "Preparing footage" until the test lets it go, the way
/// a slow copy of camera footage would.
private actor PreparingExportRunner {
    private var started = 0
    private var released = false

    nonisolated var run: NativeExportRunner {
        { project, url, progress in try await self.render(project, to: url, progress: progress) }
    }

    func render(_ project: EditorProject, to url: URL, progress: ExportProgressHandler) async throws {
        started += 1
        while !released { try await Task.sleep(for: .milliseconds(5)) }
        progress(0)
        try Data("rendered \(project.name)".utf8).write(to: url)
        progress(1)
    }

    func release() { released = true }
    func startedCount() -> Int { started }
}
