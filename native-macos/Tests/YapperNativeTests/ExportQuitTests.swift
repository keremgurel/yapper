import Foundation
import Testing
@testable import YapperNative

/// Quit anyway: every export stops and cleans up before the app exits, and
/// the alert does not promise more than it can.
@Suite
@MainActor
struct ExportQuitTests {
    private let snapshot = ExportProjectSnapshot(project: EditorProject(name: "Quit test"), package: nil)

    @Test("Quitting waits for canceled exports to remove their staged files")
    func cancelAllWaitsForCleanup() async throws {
        let folder = FileManager.default.temporaryDirectory
            .appending(path: "yapper-quit-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let center = ExportJobCenter()
        var staged: [URL] = []
        for index in 0 ..< 2 {
            let destination = folder.appending(path: "clip-\(index).mp4")
            let file = folder.appending(path: ".clip-\(index).yapper-export-\(UUID().uuidString).mp4")
            staged.append(file)
            center.start(snapshot, kind: .file, to: destination) { _ in
                try Data("partial".utf8).write(to: file)
                defer { try? FileManager.default.removeItem(at: file) }
                // Cleanup that takes a moment, like AVFoundation tearing down.
                do { try await Task.sleep(for: .seconds(60)) } catch {
                    try? await Task.sleep(for: .milliseconds(80))
                    throw error
                }
                return .file(destination)
            }
        }
        try await eventually { staged.allSatisfy { FileManager.default.fileExists(atPath: $0.path) } }

        let stoppedInTime = await center.cancelAll(waitingAtMost: .seconds(5))

        #expect(stoppedInTime)
        #expect(center.runningJobs.isEmpty)
        #expect(staged.allSatisfy { !FileManager.default.fileExists(atPath: $0.path) })
    }

    @Test("Quitting does not hang on an export that ignores the cancel")
    func cancelAllGivesUp() async {
        let center = ExportJobCenter()
        let release = Release()
        center.start(snapshot, kind: .file, to: URL(filePath: "/tmp/stuck.mp4")) { _ in
            await release.wait()
            return .file(URL(filePath: "/tmp/stuck.mp4"))
        }
        let started = ContinuousClock.now

        let stoppedInTime = await center.cancelAll(waitingAtMost: .milliseconds(150))

        #expect(!stoppedInTime)
        // "Does not hang" means it comes back at all: the export above never
        // finishes until it is released below. The bound is wide because this
        // suite runs beside a thousand other tests, and a 150 ms wait took
        // 3.6 s on a loaded machine, which failed a 2 s bound for no reason.
        #expect(ContinuousClock.now - started < .seconds(20))
        await release.open()
    }

    @Test("Nothing running means nothing to wait for")
    func cancelAllWithNothingRunning() async {
        #expect(await ExportJobCenter().cancelAll(waitingAtMost: .seconds(5)))
    }

    @Test("The alert says what is lost for renders and for uploads")
    func alertCopy() {
        func job(_ state: ExportJobState) -> ExportJob {
            ExportJob(id: UUID(), kind: .file, projectID: UUID(), projectName: "P",
                      destination: URL(filePath: "/tmp/p.mp4"), startedAt: Date(), state: state)
        }
        let render = ExportQuitCopy([job(.rendering(0.4))])
        #expect(render.title == "An export is still running")
        #expect(render.detail == "Quitting stops the render and removes its unfinished file. A file it was replacing stays as it was.")
        #expect(!render.detail.contains("Poster"))

        let upload = ExportQuitCopy([job(.posting(.registering))])
        #expect(upload.detail == "An upload to Poster stops partway. Poster may already have that video, so check Poster before you post it again.")
        #expect(!upload.detail.contains("nothing"))

        let mixed = ExportQuitCopy([job(.preparing), job(.rendering(0.1)), job(.posting(.uploading))])
        #expect(mixed.title == "3 exports are still running")
        #expect(mixed.detail.hasPrefix("Quitting stops the renders and removes their unfinished files."))
        #expect(mixed.detail.hasSuffix("check Poster before you post it again."))
    }
}

private actor Release {
    private var isOpen = false
    func open() { isOpen = true }
    func wait() async {
        // Deliberately ignores cancellation.
        while !isOpen { try? await Task.sleep(for: .milliseconds(10)) }
    }
}
