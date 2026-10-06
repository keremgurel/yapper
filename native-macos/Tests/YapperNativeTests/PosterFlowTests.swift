import Foundation
import Testing
@testable import YapperNative

@Suite struct PosterFlowTests {
    @Test func localFileOpensBeforeUploadButCannotPublishYet() {
        var video = PosterVideo(file: URL(filePath: "/tmp/finished.mp4"))
        #expect(video.canOpen)
        #expect(video.media.previewURL?.isFileURL == true)
        #expect(!video.readyToPublish)
        video.preparedSubmissionID = "uploaded"
        video.preparedContentItemID = "item"
        #expect(video.readyToPublish)
        #expect(video.submissionID == "uploaded")
        #expect(video.media.previewURL?.isFileURL == true)
    }

    @Test func projectHasStableIdentityAndOnlyRenderedFinalCanPublish() {
        let project = EditorProject(name: "An edited video")
        let listing = ProjectListing(package: ProjectPackage(url: URL(filePath: "/tmp/edit.yapperproj")), summary: ProjectSummary(project: project))
        var video = PosterVideo(project: listing)
        #expect(video.canOpen)
        #expect(!video.readyToPublish)
        #expect(video.submissionID == nil)
        video.previewURL = URL(filePath: "/tmp/final.mp4")
        #expect(video.readyToPublish)
        #expect(video.id == PosterVideo(project: listing).id)
    }

    @Test func editedRevisionInvalidatesCachedRender() throws {
        var project = EditorProject(name: "Edit")
        let first = try PosterProjectRender.revision(project)
        #expect(first == (try PosterProjectRender.revision(project)))
        project.name = "Renamed without changing the edit"
        project.updatedAt = Date()
        #expect(first == (try PosterProjectRender.revision(project)))
        project.captionsEnabled = true
        #expect(first != (try PosterProjectRender.revision(project)))
    }

    @Test @MainActor func failedPreviewNeverClaimsToStillBeLoading() async {
        let picker = PosterFramePicker()
        await picker.load(PosterMediaRef(previewURL: URL(filePath: "/does-not-exist.mp4")), initialTime: 1)
        #expect(!picker.loading)
        #expect(!picker.busy)
        #expect(picker.error != nil)
    }

    @Test @MainActor func closingInvalidatesPendingSelection() async {
        let bench = PosterBench()
        bench.active = PosterVideo(file: URL(filePath: "/tmp/a.mp4"))
        bench.close()
        #expect(bench.active == nil)
        #expect(bench.importingID == nil)
        #expect(bench.error == nil)
    }
}
