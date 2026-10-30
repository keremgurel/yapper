import Foundation
import Testing
@testable import YapperNative

/// Channel posts Yapper kept no file for: YouTube attaches the creator's own
/// original and TikTok imports, the same rules as the web Poster.
@MainActor
@Suite(.serialized)
struct PosterAttachOriginalTests {
    private func post(_ platform: PublishPlatform, id: String = "p1", url: String = "https://example.com/p1") -> PosterVideo {
        PosterVideo(platform: platform, video: PosterPlatformVideo(
            id: id, title: "Month one of ACL rehab", caption: "What the first month looked like\n#acl", thumbnail: nil,
            viewCount: 12, publishedAt: "2026-10-01T00:00:00Z", url: url, privacyStatus: "public",
            durationSec: 40, sourceFileUrl: nil, mediaKey: nil
        ))
    }

    @Test func attachingKeepsThePostAndMakesItPublishable() {
        let original = post(.youtube)
        #expect(original.needsOriginal && !original.readyToPublish)
        let file = URL(fileURLWithPath: "/tmp/original.mov")
        let attached = original.withAttachedOriginal(file: file, submissionID: "s1", contentItemID: "c1")
        #expect(attached.id == original.id && attached.title == original.title)
        #expect(attached.sourceCaption == original.sourceCaption)
        #expect(!attached.needsOriginal && attached.readyToPublish && attached.canOpen)
        #expect(attached.submissionID == "s1" && attached.contentItemID == "c1" && attached.previewURL == file)
        #expect(attached.transcriptStatus == "pending")
    }

    @Test func tiktokImportsInsteadOfAsking() {
        let video = post(.tiktok)
        #expect(video.canOpen && !video.needsOriginal)
        #expect(!post(.tiktok, url: "").canOpen)
    }

    @Test func aLateAttachNeverReplacesAnotherSelectionAndIsReusedOnReopen() async {
        let bench = PosterBench()
        let first = post(.youtube, id: "a"), second = post(.youtube, id: "b")
        await bench.open(first)
        #expect(bench.active?.id == first.id && bench.importingID == nil)
        await bench.open(second)
        bench.attach(first.withAttachedOriginal(file: URL(fileURLWithPath: "/tmp/a.mov"), submissionID: "s1", contentItemID: "c1"))
        #expect(bench.active?.id == second.id && bench.active?.needsOriginal == true)
        await bench.open(first)
        #expect(bench.active?.submissionID == "s1" && bench.active?.needsOriginal == false)
    }

    @Test func aSettledTranscriptReachesAttachedPosts() async {
        let bench = PosterBench()
        let original = post(.youtube)
        bench.attach(original.withAttachedOriginal(file: URL(fileURLWithPath: "/tmp/a.mov"), submissionID: "s1", contentItemID: "c1"))
        bench.close()
        bench.apply(PosterContentItem(id: "c1", title: "t", status: "draft", scheduledFor: nil, submissionId: "s1",
                                      transcriptStatus: "ready", updatedAt: "2026-10-01T00:00:00Z", recordedTranscript: "hello"))
        await bench.open(original)
        #expect(bench.active?.transcriptStatus == "ready" && bench.active?.noSpeech == false)
    }

    @Test func tiktokImportFailuresSaySoInTikTokTerms() {
        #expect(PosterErrorCopy.importFailure("not_owned", platform: .tiktok) == "That video does not belong to your connected TikTok account.")
        #expect(PosterErrorCopy.importFailure("import_timeout", platform: .tiktok) == "TikTok took too long to hand the file over. Try again.")
        #expect(PosterErrorCopy.importFailure("not_connected", platform: .instagram) == "Reconnect Instagram in Connections, then try again.")
        #expect(PosterErrorCopy.importFailure("rate_limited", platform: .tiktok) == "Imports are busy. Wait a few minutes before trying again.")
    }
}
