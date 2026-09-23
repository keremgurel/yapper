import Foundation
import Testing
@testable import YapperNative

/// Every reply the native Poster decodes, in the shape its route sends.
@Suite
struct PosterDecodingTests {
    private func decode<T: Decodable>(_ json: String, as type: T.Type = T.self) throws -> T {
        try JSONDecoder().decode(T.self, from: Data(json.utf8))
    }

    @Test func contentListKeepsPostableRowsNewestFirst() throws {
        let list: PosterContentList = try decode("""
        {"items":[
          {"id":"c1","title":"  ","status":"ready","stage":"library","formats":["short"],"ideaType":null,
           "scheduledFor":null,"submissionId":"s1","pillar":null,"pillarId":null,"sourceUrl":"yapper://poster-upload",
           "sourceTitle":"Poster upload","sourcePlatform":null,"transcriptStatus":"pending","script":null,
           "originalNote":"","updatedAt":"2026-09-20T10:00:00.000Z","createdAt":"2026-09-20T09:00:00.000Z"},
          {"id":"c2","title":"Why hooks fail","status":"posted","stage":"library","formats":[],"ideaType":"original",
           "scheduledFor":"2026-09-25T15:30:00.000Z","submissionId":"s2","pillar":"Craft","pillarId":"p1",
           "sourceUrl":null,"sourceTitle":null,"sourcePlatform":null,"transcriptStatus":"ready","script":"Hi",
           "originalNote":"","updatedAt":"2026-09-22T10:00:00.000Z","createdAt":"2026-09-21T09:00:00.000Z"},
          {"id":"c3","title":"Idea only","status":"captured","stage":"bank","formats":[],"ideaType":null,
           "scheduledFor":null,"submissionId":null,"pillar":null,"pillarId":null,"sourceUrl":null,"sourceTitle":null,
           "sourcePlatform":null,"transcriptStatus":null,"script":null,"originalNote":"",
           "updatedAt":"2026-09-23T10:00:00.000Z","createdAt":"2026-09-23T09:00:00.000Z"}
        ]}
        """)
        let videos = PosterContentItem.postable(list.items).map(PosterVideo.init(item:))
        #expect(videos.map(\.id) == ["c2", "c1"])
        #expect(videos[1].title == "Untitled")
        #expect(videos[0].submissionID == "s2")
        #expect(videos[0].transcriptStatus == "ready")
    }

    @Test func contentEnvelope() throws {
        let envelope: PosterContentEnvelope = try decode("""
        {"item":{"id":"c9","title":"export","status":"captured","stage":"library","formats":[],"ideaType":null,
         "scheduledFor":null,"submissionId":"s9","pillar":null,"pillarId":null,"sourceUrl":"yapper://poster-upload",
         "sourceTitle":"Poster upload","sourcePlatform":null,"transcriptStatus":"pending","script":null,"originalNote":"",
         "updatedAt":"2026-09-23T10:00:00.000Z","createdAt":"2026-09-23T10:00:00.000Z","hooks":[],"blocks":[],
         "format":null,"summary":null,"sourceTranscript":null,"recordedTranscript":null,"sourceSummary":null,
         "sourceReferenceType":null,"points":[],"example":"","cta":""}}
        """)
        #expect(envelope.item.submissionId == "s9")
    }

    @Test func platformVideosAndOpenability() throws {
        let list: PosterPlatformVideos = try decode("""
        {"connected":true,"videos":[
          {"id":"179","title":"Reel one","caption":"Line one\\n#tag","thumbnail":"https://cdn.example.com/a.jpg",
           "viewCount":1520,"publishedAt":"2026-09-01T12:00:00+0000","privacyStatus":"public",
           "url":"https://www.instagram.com/reel/abc/","sourceFileUrl":"https://cdn.example.com/a.mp4"},
          {"id":"180","title":"","thumbnail":null,"viewCount":0,"publishedAt":"2026-08-01T12:00:00+0000",
           "privacyStatus":"public","url":"https://www.instagram.com/reel/def/","sourceFileUrl":null,
           "mediaKey":"users/u/recordings/x.mp4","sourcePlatform":"youtube","durationSec":31.5}
        ]}
        """)
        #expect(list.connected)
        let reel = PosterVideo(platform: .instagram, video: list.videos[0])
        #expect(reel.id == "instagram:179")
        #expect(reel.canOpen)
        #expect(reel.sourceCaption == "Line one\n#tag")
        #expect(reel.originalThumbnailPath == "api/publish/instagram/thumbnail?mediaId=179")
        let kept = PosterVideo(platform: .instagram, video: list.videos[1])
        #expect(kept.title == "Untitled")
        #expect(kept.mediaKey == "users/u/recordings/x.mp4")

        let youtube: PosterPlatformVideos = try decode("""
        {"connected":true,"videos":[{"id":"yt1","title":"Short","thumbnail":"https://i.ytimg.com/vi/yt1/hq.jpg",
         "viewCount":88,"publishedAt":"2026-09-10T08:00:00Z","privacyStatus":"public",
         "url":"https://youtube.com/shorts/yt1","durationSec":42}]}
        """)
        #expect(!PosterVideo(platform: .youtube, video: youtube.videos[0]).canOpen)
    }

    @Test func connectionsWithAccountIDs() throws {
        let response: PosterConnections = try decode("""
        {"connections":[
          {"platform":"facebook","handle":null,"externalAccountId":"page_1","status":"active","updatedAt":"2026-09-01T00:00:00.000Z"},
          {"platform":"youtube","handle":"@kerem","externalAccountId":"UC123","status":"active","updatedAt":"2026-09-01T00:00:00.000Z"},
          {"platform":"tiktok","handle":"kerem","externalAccountId":null,"status":"reauth_required","updatedAt":"2026-09-01T00:00:00.000Z"}
        ],"available":["youtube","tiktok","instagram","facebook"]}
        """)
        #expect(response.connections.count == 3)
        #expect(response.connections[0].externalAccountId == "page_1")
    }

    @Test func captionsAndRendering() throws {
        let response: PosterCaptionResponse = try decode("""
        {"captions":[
          {"platform":"youtube","title":"Why your hook dies at second two","body":"The fix is simpler than it looks.","hashtags":["shorts","hooks"]},
          {"platform":"tiktok","title":"","body":"nobody tells you this","hashtags":["creator"]}
        ],"balance":41,"used":true}
        """)
        #expect(response.captions[0].rendered == "The fix is simpler than it looks.\n\n#shorts #hooks")
        let merged = PosterCaptionSet().merging(generated: response.captions, titleOnly: true, sourceCaption: "Original")
        #expect(merged[.youtube]?.body == "Original")
        #expect(merged[.youtube]?.title == "Why your hook dies at second two")
    }

    @Test func publishResults() throws {
        let live: PosterPublishResult = try decode(#"{"jobId":"job_1","url":"https://youtube.com/shorts/abc"}"#)
        #expect(live.url == "https://youtube.com/shorts/abc")
        let draft: PosterPublishResult = try decode(#"{"jobId":"job_2","draft":true}"#)
        #expect(draft.draft == true)
    }

    @Test func tiktokReviewInputs() throws {
        let preview: PosterVideoPreview = try decode(#"{"url":"https://r2.example.com/v.mp4?sig=1","duration":37.2,"width":1080,"height":1920}"#)
        let context: PosterTikTokContext = try decode("""
        {"creator":{"creator_nickname":"Kerem","creator_username":"kerem","creator_avatar_url":"https://p16.example.com/a.jpg",
         "privacy_level_options":["PUBLIC_TO_EVERYONE","MUTUAL_FOLLOW_FRIENDS","SELF_ONLY"],
         "comment_disabled":false,"duet_disabled":true,"stitch_disabled":false,"max_video_post_duration_sec":600},
         "accountId":"tt_1","audited":false}
        """)
        var settings = PosterTikTokSettings()
        settings.accountId = context.accountId
        settings.privacy = "PUBLIC_TO_EVERYONE"
        settings.consent = true
        #expect(settings.problem(creator: context.creator, duration: preview.duration, audited: context.audited) == "audit_required")
        settings.privacy = "SELF_ONLY"
        #expect(settings.problem(creator: context.creator, duration: preview.duration, audited: context.audited) == nil)
        settings.allowDuet = true
        #expect(settings.problem(creator: context.creator, duration: preview.duration, audited: context.audited) == "interaction_disabled")
    }

    @Test func schedules() throws {
        let list: PosterSchedules = try decode("""
        {"enabled":true,"schedules":[{"id":"sch_1","platform":"youtube","accountLabel":"@kerem","title":"Short",
         "scheduledFor":"2026-09-24T15:00:00.000Z","timezone":"America/Toronto","status":"scheduled","error":null,
         "externalUrl":null,"contentItemId":"c2"}]}
        """)
        #expect(list.enabled)
        let created: PosterScheduleCreated = try decode("""
        {"schedules":[{"id":"sch_2","platform":"instagram","accountLabel":"kerem","title":"Reel",
         "scheduledFor":"2026-09-24T15:00:00.000Z","timezone":"UTC","status":"scheduled","error":null,
         "externalUrl":null,"contentItemId":null}]}
        """)
        #expect(created.schedules.first?.platform == "instagram")
    }

    @Test func mediaReplies() throws {
        let ticket: PosterUploadTicket = try decode(#"{"url":"https://r2.example.com/put?sig=1","key":"users/u/recordings/k.mp4"}"#)
        #expect(ticket.key.hasSuffix(".mp4"))
        let submission: PosterSubmissionEnvelope = try decode("""
        {"submission":{"id":"s1","userId":"u","mediaKey":"users/u/recordings/k.mp4","title":"export","durationSec":31,
         "createdAt":"2026-09-23T10:00:00.000Z"}}
        """)
        #expect(submission.submission.mediaKey == "users/u/recordings/k.mp4")
        let signed: PosterSignedURL = try decode(#"{"url":"https://r2.example.com/get?sig=2"}"#)
        #expect(signed.url.contains("sig=2"))
        let imported: PosterImportedMedia = try decode(#"{"mediaKey":"users/u/imports/ig.mp4","title":"My reel"}"#)
        #expect(imported.title == "My reel")
        let transcript: PosterTranscript = try decode("""
        {"words":[{"text":"Hello","start":0,"end":0.4},{"text":" world ","start":0.4,"end":0.8},{"start":1,"end":1.1}],
         "coverageChecked":true,"balance":12}
        """)
        #expect(transcript.text == "Hello world")
        let thumbnail: PosterGeneratedThumbnail = try decode(#"{"image":"data:image/png;base64,iVBORw0KGgo=","balance":40}"#)
        #expect(thumbnail.image.hasPrefix("data:image/png"))
    }

    @Test func readinessNamesWhatBlocks() {
        let empty = PosterReadiness(platform: .youtube, connected: true, caption: .blank(.youtube), hasCover: false)
        #expect(empty.state == .empty)
        let caption = PosterCaption(platform: "youtube", title: "", body: "Body", hashtags: [])
        let blocked = PosterReadiness(platform: .youtube, connected: true, caption: caption, hasCover: false)
        #expect(blocked.state == .blocked)
        #expect(blocked.blockers == ["A title is required.", "Pick a cover image."])
        let ready = PosterReadiness(platform: .instagram, connected: true, caption: caption, hasCover: false)
        #expect(ready.state == .ready)
        #expect(PosterPublishSummary([blocked, ready]).label == "Publish to 1 destination")
        #expect(PosterHashtags.add("#growth, tips #growth", to: ["tips"]) == ["tips", "growth"])
    }

    @Test func outgoingCopyPrefersPreparedCaptions() {
        let target = PosterPublishTarget(
            id: "c2", title: "Library title", fallbackTitle: "Cover headline",
            captions: [.instagram: PosterCaption(platform: "instagram", title: "", body: "Hook line", hashtags: ["reels"])],
            submissionID: "s2", mediaKey: nil, contentItemID: "c2", thumbnailKey: "users/u/thumbnails/t.png"
        )
        #expect(target.copy(for: .instagram).body == "Hook line\n\n#reels")
        #expect(target.copy(for: .youtube).title == "Cover headline")
        #expect(target.copy(for: .youtube).body.isEmpty)
    }
}
