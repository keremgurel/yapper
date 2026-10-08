import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

struct StudioEditorTests {
    private let itemID = UUID(uuidString: "8e5e8f27-3256-4b83-9c2a-403314d1de60")!
    private let submissionID = UUID(uuidString: "3ba34d7e-36ca-41cb-9056-5c9a1a7e5612")!

    @Test func handoffAcceptsOnlyAnEditorIntentWithOneValidIdentity() throws {
        let link = URL(string: "yapper-studio://open/editor?item=\(itemID)")!
        #expect(StudioEditorRequest(url: link)?.itemID == itemID)
        #expect(StudioEditorRequest(url: URL(string: "yapper-studio://open/editor")!) != nil)
        for value in [
            "https://open/editor", "yapper-studio://auth/callback?item=\(itemID)",
            "yapper-studio://open/editor?item=bad", "yapper-studio://open/editor?item",
            "yapper-studio://open/editor?item=\(itemID)&item=\(itemID)",
        ] {
            #expect(StudioEditorRequest(url: URL(string: value)!) == nil)
        }
    }

    @Test func embeddedLibraryLinksPreserveTheirRecording() {
        #expect(CloudLinkRouter.disposition(
            for: URL(string: "https://ypr.app/studio/editor?item=\(itemID)")!,
            nativeDestination: .ideas
        ) == .openEditor(itemID))
        #expect(CloudLinkRouter.disposition(
            for: URL(string: "yapper-studio://open/editor?item=\(itemID)")!,
            nativeDestination: .editor
        ) == .openEditor(itemID))
    }

    @Test func resolvesMediaThroughAuthenticatedOwnershipRoutes() async throws {
        let itemID = itemID, submissionID = submissionID
        let recording = try await StudioEditorService.resolve(itemID: itemID) { url in
            #expect(url.host == "ypr.app")
            switch url.path {
            case "/api/content/\(itemID.uuidString.lowercased())":
                return Data("{\"item\":{\"id\":\"\(itemID)\",\"title\":\"My take\",\"submissionId\":\"\(submissionID)\"}}".utf8)
            case "/api/submissions/\(submissionID.uuidString.lowercased())":
                return Data("{\"submission\":{\"id\":\"\(submissionID)\",\"userId\":\"user_a\",\"mediaKey\":\"u/user_a/video & take.mp4\"}}".utf8)
            case "/api/media/sign":
                #expect(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first?.value == "u/user_a/video & take.mp4")
                return Data("{\"url\":\"https://signed.example/take.mp4\"}".utf8)
            default: throw StudioEditorError.invalidResponse
            }
        }
        #expect(recording.source == StudioContentSource(userID: "user_a", itemID: itemID, submissionID: submissionID))
        #expect(recording.fileExtension == "mp4")
        #expect(recording.title == "My take")
    }

    @Test func itemsWithoutATakeFailBeforeMediaIsRequested() async {
        let itemID = itemID
        do {
            _ = try await StudioEditorService.resolve(itemID: itemID) { url in
                #expect(url.path.hasPrefix("/api/content/"))
                return Data("{\"item\":{\"id\":\"\(itemID)\",\"title\":\"Draft\",\"submissionId\":null}}".utf8)
            }
            Issue.record("A draft must not open an unrelated recording")
        } catch StudioEditorError.noRecording { } catch { Issue.record("Unexpected error: \(error)") }
    }

    @Test func aResponseForAnotherItemIsRejected() async {
        do {
            _ = try await StudioEditorService.resolve(itemID: itemID) { _ in
                Data("{\"item\":{\"id\":\"\(UUID())\",\"title\":\"Wrong item\",\"submissionId\":null}}".utf8)
            }
            Issue.record("Mismatched item was accepted")
        } catch StudioEditorError.invalidResponse { } catch { Issue.record("Unexpected error: \(error)") }
    }

    @Test func projectReferencesResolveWithoutRequestingOrDownloadingMedia() async throws {
        let itemID = itemID, projectID = UUID()
        // The cloud export can already have been cleaned up; the project still opens.
        let item = try await StudioEditorService.resolveItem(itemID: itemID) { url in
            #expect(url.path == "/api/content/\(itemID.uuidString.lowercased())")
            return Data("{\"item\":{\"id\":\"\(itemID)\",\"title\":\"ep14\",\"submissionId\":null,\"sourceUrl\":\"yapper://project/\(projectID)\"}}".utf8)
        }
        #expect(try item.projectID == projectID)
        do {
            _ = try await StudioEditorService.resolveRecording(item: item) { _ in
                Issue.record("A project reference must not request cloud video")
                throw StudioEditorError.invalidResponse
            }
            Issue.record("A project reference must not be imported as a recording")
        } catch StudioEditorError.projectMissing { }
    }

    @Test func malformedProjectReferencesNeverFallBackToImportingVideo() throws {
        for url in ["yapper://project/not-a-uuid", "yapper://project/\(UUID())/extra", "yapper://project/\(UUID())?copy=1"] {
            let item = StudioEditorItem(id: itemID, title: "ep14", submissionId: submissionID, sourceUrl: url)
            #expect(throws: (any Error).self) { try item.projectID }
        }
    }

    @Test func originalProjectLookupIgnoresFlattenedCopiesAndSurvivesRename() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "ProjectSource-\(UUID())")
        defer { try? FileManager.default.removeItem(at: root) }
        let library = ProjectLibrary(directory: root)
        let original = try await library.create(named: "ep14")
        let timeline = EditorProject(name: "ep14")
        try await ProjectPackageStore(package: original).save(timeline)
        let duplicate = try await library.create(named: "ep14")
        var flattened = EditorProject(name: "ep14")
        flattened.studioSource = StudioContentSource(userID: "owner", itemID: itemID, submissionID: submissionID)
        try await ProjectPackageStore(package: duplicate).save(flattened)
        let renamed = try await library.rename(original, to: "Episode fourteen")
        #expect(try await library.project(id: timeline.id)?.url.standardizedFileURL.path == renamed.url.standardizedFileURL.path)
        #expect(try await library.project(id: UUID()) == nil)
        #expect(try await library.listings().count == 2)
        // Projects moved outside the default library still resolve through recents.
        let outsideLibrary = ProjectLibrary(directory: root.appending(path: "Another folder"))
        #expect(try await outsideLibrary.project(id: timeline.id, recentURLs: [renamed.url]) == renamed)
    }

    @Test func aDownloadedRecordingSurvivesReopenRenameAndCopy() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "StudioEditor-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let movie = root.appending(path: "download.mov")
        try await SyntheticVideo.write(color: CGColor(gray: 0.4, alpha: 1), size: CGSize(width: 64, height: 96), to: movie)
        let library = ProjectLibrary(directory: root.appending(path: "Projects"))
        let source = StudioContentSource(userID: "user_a", itemID: itemID, submissionID: submissionID)
        let recording = StudioEditorRecording(source: source, title: "Saved take", url: URL(string: "https://signed.example/take.mov")!, fileExtension: "mov")
        let package = try await StudioEditorService.install(downloadedFile: movie, recording: recording, in: library)
        let loaded = try #require(try await ProjectPackageStore(package: package).load())
        #expect(loaded.studioSource == source)
        #expect(loaded.clips.count == 1)
        #expect(loaded.clips[0].duration > 0)
        #expect(loaded.media[0].url.path.hasPrefix(package.url.path + "/recordings/"))
        let found = try await library.project(for: source)
        #expect(found?.url.standardizedFileURL.path == package.url.standardizedFileURL.path)
        #expect(try await library.project(for: StudioContentSource(userID: "other_account", itemID: itemID, submissionID: submissionID)) == nil)
        #expect(try await library.project(for: StudioContentSource(userID: "user_a", itemID: itemID, submissionID: UUID())) == nil)

        let renamed = try await library.rename(package, to: "Renamed take")
        let renamedProject = try #require(try await ProjectPackageStore(package: renamed).load())
        #expect(FileManager.default.fileExists(atPath: renamedProject.media[0].url.path))
        let copy = try await library.duplicate(renamed)
        let copiedProject = try #require(try await ProjectPackageStore(package: copy).load())
        #expect(copiedProject.media[0].url != renamedProject.media[0].url)
        try FileManager.default.removeItem(at: renamed.url)
        #expect(try await MediaProbe.inspect(url: copiedProject.media[0].url).duration > 0)
    }

    @Test func invalidDownloadsDoNotLeaveAnEmptyProject() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "StudioEditor-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let badFile = root.appending(path: "bad.mp4")
        try Data("not a movie".utf8).write(to: badFile)
        let library = ProjectLibrary(directory: root.appending(path: "Projects"))
        let recording = StudioEditorRecording(
            source: StudioContentSource(userID: "user_a", itemID: itemID, submissionID: submissionID),
            title: "Bad download", url: URL(string: "https://signed.example/bad.mp4")!, fileExtension: "mp4"
        )
        do {
            _ = try await StudioEditorService.install(downloadedFile: badFile, recording: recording, in: library)
            Issue.record("Unreadable media was saved")
        } catch { }
        #expect(try FileManager.default.contentsOfDirectory(atPath: library.directory.path).isEmpty)
    }
}
