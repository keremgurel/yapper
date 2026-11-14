import Foundation
import Testing
@testable import YapperNative

@Suite
@MainActor
struct ExportJobCenterTests {
    private let snapshot = ExportProjectSnapshot(
        project: EditorProject(name: "Talking head"),
        package: ProjectPackage(url: URL(filePath: "/tmp/Talking head.yapperproj"))
    )
    private let destination = URL(filePath: "/tmp/talking-head.mp4")

    @Test("A job keeps the project's identity from when it started")
    func jobCapturesSnapshotIdentity() async throws {
        let center = ExportJobCenter()
        let id = center.start(snapshot, kind: .file, to: destination) { _ in .file(destination) }
        let job = try #require(center.job(id))
        #expect(job.projectID == snapshot.project.id)
        #expect(job.projectName == "Talking head")
        #expect(job.state == .preparing)

        let ended = try #require(await center.completion(of: id))
        #expect(ended.state == .finished(.file(destination)))
    }

    @Test("Progress only moves forward and stops once the job has ended")
    func progressIsMonotonic() async throws {
        let center = ExportJobCenter()
        let gate = Gate()
        var reporter: ExportJobReporter?
        let id = center.start(snapshot, kind: .file, to: destination) { report in
            reporter = report
            await gate.wait()
            return .file(destination)
        }
        try await eventually { reporter != nil }
        let report = try #require(reporter)

        report.rendered(0.5)
        report.rendered(0.3)
        #expect(center.job(id)?.state == .rendering(0.5))
        report.rendered(0.756)
        #expect(center.job(id)?.state == .rendering(0.75))

        await gate.open()
        _ = await center.completion(of: id)
        report.rendered(0.9)
        #expect(center.job(id)?.state == .finished(.file(destination)))
    }

    @Test("The project counts as in use only while its footage is being copied")
    func readingSourcesWindow() async throws {
        let center = ExportJobCenter()
        let gate = Gate()
        var reporter: ExportJobReporter?
        let id = center.start(snapshot, kind: .file, to: destination) { report in
            reporter = report
            await gate.wait()
            return .file(destination)
        }
        #expect(center.isReadingSources(projectID: snapshot.projectID))
        #expect(!center.isReadingSources(projectID: UUID()))
        #expect(center.isExporting(to: destination))

        try await eventually { reporter != nil }
        reporter?.rendered(0)
        #expect(!center.isReadingSources(projectID: snapshot.projectID))
        #expect(center.isExporting(to: destination))

        await gate.open()
        _ = await center.completion(of: id)
        #expect(!center.isExporting(to: destination))
    }

    @Test("Dismissing clears finished jobs and never a running one")
    func dismissal() async throws {
        let center = ExportJobCenter()
        let gate = Gate()
        let done = center.start(snapshot, kind: .file, to: destination) { _ in .file(destination) }
        _ = await center.completion(of: done)
        let running = center.start(snapshot, kind: .file, to: URL(filePath: "/tmp/second.mp4")) { _ in
            await gate.wait()
            return .file(URL(filePath: "/tmp/second.mp4"))
        }

        center.dismiss(running)
        #expect(center.job(running) != nil)
        center.dismissFinished()
        #expect(center.jobs.map(\.id) == [running])

        await gate.open()
        _ = await center.completion(of: running)
        center.dismiss(running)
        #expect(center.jobs.isEmpty)
    }

    @Test("Poster uploads use the title captured at the start, not the open project's")
    func posterTitleComesFromSnapshot() async throws {
        let center = ExportJobCenter()
        let titles = TitleRecorder()
        var stateDuringUpload: ExportJobState?
        let work = ExportJobWork.poster(
            snapshot,
            to: destination,
            runner: { _, _, progress in progress(1) },
            handoff: { _, title, stage in
                await titles.record(title)
                stage(.uploading)
                stateDuringUpload = center.jobs.first?.state
                return "item-42"
            }
        )
        let id = center.start(snapshot, kind: .poster, to: destination, work: work)
        let ended = try #require(await center.completion(of: id))

        #expect(await titles.all() == ["Talking head"])
        #expect(stateDuringUpload == .posting(.uploading))
        #expect(ended.state == .finished(.poster(itemID: "item-42")))
    }

    @Test("One file is one key, however its URL is spelled")
    func destinationKeys() throws {
        let folder = FileManager.default.temporaryDirectory
            .appending(path: "yapper-destination-key-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let key = ExportDestinationKey.of(folder.appending(path: "Export.mp4"))

        #expect(ExportDestinationKey.of(folder.appending(path: "export.MP4")) == key)
        #expect(ExportDestinationKey.of(URL(filePath: "/private/tmp/a.mp4")) == ExportDestinationKey.of(URL(filePath: "/tmp/a.mp4")))
        #expect(ExportDestinationKey.of(folder.appending(path: "sub/../Export.mp4")) == key)
        // Precomposed and decomposed é name one file on APFS.
        #expect(ExportDestinationKey.of(folder.appending(path: "Caf\u{E9}.mp4"))
            == ExportDestinationKey.of(folder.appending(path: "Cafe\u{301}.mp4")))
        #expect(ExportDestinationKey.of(folder.appending(path: "Other.mp4")) != key)
    }

    @Test("A reserved file is taken until it is released or a job takes it over")
    func reservations() async throws {
        let center = ExportJobCenter()
        let gate = Gate()
        #expect(center.reserve(URL(filePath: "/tmp/Clip.mp4")))
        #expect(!center.reserve(URL(filePath: "/private/tmp/clip.mp4")))
        #expect(center.isExporting(to: URL(filePath: "/tmp/CLIP.mp4")))
        center.releaseReservation(URL(filePath: "/tmp/Clip.mp4"))
        #expect(!center.isExporting(to: URL(filePath: "/tmp/Clip.mp4")))

        #expect(center.reserve(destination))
        let id = center.start(snapshot, kind: .file, to: destination) { _ in
            await gate.wait()
            return .file(URL(filePath: "/tmp/talking-head.mp4"))
        }
        #expect(!center.reserve(destination))
        await gate.open()
        _ = await center.completion(of: id)
        #expect(center.reserve(destination))
    }

    @Test("The badge sums up running, failed and finished jobs")
    func summary() {
        func job(_ state: ExportJobState) -> ExportJob {
            ExportJob(id: UUID(), kind: .file, projectID: UUID(), projectName: "P",
                      destination: destination, startedAt: Date(), state: state)
        }
        #expect(ExportJobsSummary(jobs: []) == nil)
        #expect(ExportJobsSummary(jobs: [job(.preparing)])?.label == "Preparing export")
        #expect(ExportJobsSummary(jobs: [job(.rendering(0.42))])?.label == "Exporting 42%")
        #expect(ExportJobsSummary(jobs: [job(.posting(.uploading))])?.label == "Sending to Poster")
        let two = ExportJobsSummary(jobs: [job(.rendering(0.2)), job(.rendering(0.6)), job(.finished(.file(destination)))])
        #expect(two?.label == "2 exports · 40%")
        #expect(two?.tone == .running)
        #expect(ExportJobsSummary(jobs: [job(.finished(.file(destination))), job(.failed("No"))])?.tone == .failed)
        #expect(ExportJobsSummary(jobs: [job(.finished(.file(destination)))])?.label == "Exported")
        var saved = job(.finished(.file(destination)))
        saved = ExportJob(id: saved.id, kind: .file, projectID: saved.projectID, projectName: "P",
                          destination: URL(filePath: "/Users/someone/Exports folder/p.mp4"),
                          startedAt: saved.startedAt, state: saved.state)
        #expect(ExportJobCopy.status(saved) == "Saved to Exports folder")
    }
}

private actor Gate {
    private var isOpen = false
    func open() { isOpen = true }
    func wait() async {
        while !isOpen { try? await Task.sleep(for: .milliseconds(5)) }
    }
}

private actor TitleRecorder {
    private var titles: [String] = []
    func record(_ title: String) { titles.append(title) }
    func all() -> [String] { titles }
}
