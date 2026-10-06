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
    @Test @MainActor func aNewEditDoesNotReuseItsPreviousCover() {
        let drafts = PosterDraftStore()
        let video = PosterVideo(file: URL(filePath: "/tmp/edit.mp4"))
        drafts.useRevision("first", for: video)
        var cover = PosterCoverDraft()
        cover.headline = "Previous edit"
        drafts.setCover(cover, for: video)
        drafts.useRevision("first", for: video)
        #expect(drafts.hasCover(video))
        drafts.useRevision("second", for: video)
        #expect(!drafts.hasCover(video))
    }

    @Test @MainActor func copiedCaptionOnlyChangesChosenBodiesAndTags() {
        let drafts = PosterDraftStore()
        let video = PosterVideo(file: URL(filePath: "/tmp/test.mp4"))
        drafts.setCaption(PosterCaption(platform: "tiktok", title: "", body: "My description", hashtags: ["video"]), for: video)
        drafts.setCaption(PosterCaption(platform: "youtube", title: "Keep this title", body: "Old", hashtags: []), for: video)
        drafts.setCaption(PosterCaption(platform: "facebook", title: "", body: "Unselected", hashtags: []), for: video)
        drafts.copyCaption(from: .tiktok, to: [.tiktok, .youtube, .instagram], for: video)
        let captions = drafts.captions(video)
        #expect(captions[.youtube]?.title == "Keep this title")
        #expect(captions[.youtube]?.rendered == "My description\n\n#video")
        #expect(captions[.instagram]?.body == "My description")
        #expect(captions[.facebook]?.body == "Unselected")
        #expect(captions[.tiktok]?.body == "My description")
        let other = PosterVideo(file: URL(filePath: "/tmp/other.mp4"))
        #expect(drafts.captions(other).isEmpty)
    }

    @Test func silentTranscriptDecodesAsSuccessfulEmptyResult() throws {
        let transcript = try JSONDecoder().decode(PosterTranscript.self, from: Data(#"{"words":[],"coverageChecked":false}"#.utf8))
        #expect(transcript.text.isEmpty)
        let summary = try JSONDecoder().decode(PosterContentItem.self, from: Data(#"{"id":"silent","title":"Silent video","status":"captured","updatedAt":"2026-10-07","transcriptStatus":"ready","noSpeech":true}"#.utf8))
        #expect(PosterVideo(item: summary).noSpeech)
    }

}
