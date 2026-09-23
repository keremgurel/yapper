import Foundation
import Testing
@testable import YapperNative

struct IdeasDecodingTests {
    private func decode<T: Decodable>(_ json: String, as type: T.Type = T.self) throws -> T {
        try StudioJSONClient.decoder.decode(T.self, from: Data(json.utf8))
    }

    private func object(_ value: some Encodable) throws -> [String: Any] {
        try JSONSerialization.jsonObject(with: StudioJSONClient.encoder.encode(value)) as! [String: Any]
    }

    @Test func decodesTheIdeasList() throws {
        let response: IdeaListResponse = try decode("""
        {"items":[{"id":"7b1c2f5e-0000-4000-8000-000000000001","title":"Why hooks fail","status":"drafting","stage":"bank",
        "formats":["short","article"],"ideaType":"semi-original","scheduledFor":null,"submissionId":null,"pillar":"Craft",
        "pillarId":"p1","sourceUrl":"https://www.instagram.com/reel/abc/","sourceTitle":"A reel","sourcePlatform":"instagram",
        "transcriptStatus":"ready","script":"Most hooks fail because","originalNote":"my take on this","updatedAt":"2026-09-20T14:02:11.123Z",
        "createdAt":"2026-09-19T09:00:00.000Z"},
        {"id":"x2","title":"","status":"somethingNew","stage":"library","ideaType":null,"originalNote":"Ship it. Then tell people.",
        "updatedAt":"2026-09-21T10:00:00Z","createdAt":"2026-09-21T10:00:00Z"}]}
        """)
        #expect(response.items.count == 2)
        let first = response.items[0]
        #expect(first.pipelineStatus == .drafting)
        #expect(first.formats == ["short", "article"])
        #expect(first.hasScript)
        #expect(first.updatedDate != nil)
        let second = response.items[1]
        #expect(second.formats.isEmpty)
        #expect(second.pipelineStatus == .captured)
        #expect(second.displayTitle == "Ship it")
        #expect(second.updatedDate != nil)
    }

    @Test func decodesACreatedDetailRow() throws {
        let response: IdeaItemResponse = try decode("""
        {"item":{"id":"n1","title":"","status":"drafting","stage":"library","formats":[],"ideaType":null,"scheduledFor":null,
        "submissionId":null,"pillar":null,"pillarId":null,"sourceUrl":null,"sourceTitle":null,"sourcePlatform":null,
        "transcriptStatus":null,"script":null,"originalNote":"","updatedAt":"2026-09-23T08:00:00.000Z","createdAt":"2026-09-23T08:00:00.000Z",
        "hooks":[],"blocks":[{"label":"Direction","kind":"paragraph","text":"x"}],"format":null,"summary":null,"sourceTranscript":null,
        "recordedTranscript":null,"sourceSummary":null,"sourceReferenceType":null,"points":[],"example":"","cta":""}}
        """)
        #expect(response.item.id == "n1")
        #expect(response.item.displayTitle == "Untitled idea")
    }

    @Test func decodesSavedViews() throws {
        let response: LibraryViewsResponse = try decode("""
        {"views":[{"id":"v1","name":"All","kind":"table","groupBy":null,"filters":{},"columns":[],"sortOrder":0},
        {"id":"v2","name":"Not posted","kind":"table","groupBy":null,"filters":{"status":["captured","drafting","ready"]},"columns":[],"sortOrder":1},
        {"id":"v3","name":"By status","kind":"board","groupBy":"status","filters":{},"columns":["pillar","status"],"sortOrder":2}]}
        """)
        #expect(response.views.count == 3)
        #expect(response.views[1].filters["status"]?.count == 3)
        #expect(response.views[2].layout == .board)
        #expect(response.views[2].grouping == .status)
        #expect(IdeaColumn.resolve(response.views[2].columns) == [.title, .pillar, .status])
        #expect(IdeaColumn.resolve(response.views[0].columns) == IdeaColumn.defaults)

        let one: LibraryViewResponse = try decode("""
        {"view":{"id":"v4","name":"New view","kind":"table","groupBy":null,"filters":{},"columns":[],"sortOrder":3}}
        """)
        #expect(one.view.name == "New view")
        let body = try object(ViewDraft.fresh)
        #expect(body["groupBy"] is NSNull)
    }

    @Test func decodesEnrichmentReplies() throws {
        let link: ResolvedLink = try decode("""
        {"kind":"video","platform":"instagram","title":"Reel","author":"someone","transcript":"words here","referenceType":"social-video","balance":41}
        """)
        #expect(link.transcript == "words here")
        let source = IdeaSource(url: "https://instagram.com/reel/abc", resolved: link)
        #expect(SourcePatch(source).transcriptStatus == "ready")

        let expand: ExpandResponse = try decode("""
        {"expansion":{"title":"Hooks","pillar":"Craft","format":"talking head","summary":"The angle.",
        "sections":[{"label":"Beats","kind":"steps","items":["a","b"]},{"label":"Draft script","kind":"script","text":" Say this. "},
        {"label":"Empty","kind":"paragraph","text":"  "}],"hooks":["Stop doing this"]},"balance":40,"used":[]}
        """)
        let patch = ExpansionPatch(try #require(expand.expansion))
        #expect(patch.blocks.map(\.label) == ["Direction", "Beats", "Draft script"])
        #expect(patch.script == "Say this.")
        let body = try object(patch)
        let hooks = body["hooks"] as? [[String: Any]]
        #expect(hooks?.first?["pattern"] is NSNull)
    }

    @Test func decodesTheSmallReplies() throws {
        let pillars: ProjectPillarsResponse = try decode("""
        {"project":{"id":"p","name":"Me"},"pillars":[{"id":"a","name":"Craft","description":"","examples":[],"sortOrder":0}]}
        """)
        #expect(pillars.pillars.map(\.name) == ["Craft"])
        let bulk: BulkResponse = try decode(#"{"updated":3}"#)
        #expect(bulk.updated == 3)
        let imported: ImportResponse = try decode(#"{"imported":12,"received":14}"#)
        #expect(imported.imported == 12)
        let ticket: DictationTranscriber.Ticket = try decode(#"{"key":"transcription/u/1","url":"https://r2.example/put"}"#)
        #expect(ticket.key == "transcription/u/1")
        let words: DictationTranscriber.Reply = try decode(#"{"words":[{"text":"hello","start":0,"end":0.3},{"text":"there","start":0.3,"end":0.6}]}"#)
        #expect(words.text == "hello there")

        let clear = try object(BulkRequest(ids: ["a"], action: .pillar(nil)))
        #expect(clear["pillarId"] is NSNull)
        #expect(clear["action"] as? String == "pillar")
    }

    @Test func capturesSplitWordsAndLinks() {
        let parsed = CaptureText.parse("my take https://youtu.be/x?t=1 on this")
        #expect(parsed.url == "https://youtu.be/x?t=1")
        #expect(parsed.note == "my take   on this")
        #expect(CaptureText.kind(note: parsed.note, url: parsed.url) == .semiOriginal)
        #expect(CaptureText.kind(note: nil, url: "https://a.com") == .inspiration)
        #expect(CaptureText.links(in: "see https://a.com, then") == ["https://a.com"])
        let text = "watch https://a.com/x"
        #expect(CaptureText.linkEnding(at: (text as NSString).length, in: text) != nil)
    }

    @Test func dictationLandsAtTheCaret() {
        let result = CaptureText.insertDictation("hello", into: "abc.", selection: NSRange(location: 3, length: 0))
        #expect(result.text == "abc hello.")
        #expect(result.caret == 9)
        let appended = CaptureText.insertDictation("more", into: "start", selection: NSRange(location: NSNotFound, length: 0))
        #expect(appended.text == "start more")
    }

    @Test func parsesInstagramExports() {
        let json = """
        {"saved_saved_media":[{"title":"chef","string_list_data":[{"href":"https://www.instagram.com/reel/AbC/?igsh=1","timestamp":1700000000}]}],
        "saved_collections":[{"title":"Hooks","name":"Hooks"},{"string_list_data":[{"href":"https://instagram.com/p/Zz/"}]}]}
        """
        let entries = InstagramSavedParser.parse(files: [
            "your_instagram_activity/saved/saved_posts.json": json,
            "saved.html": "<a href=\"https://www.instagram.com/p/Zz/\">x</a><a href=\"https://example.com\">y</a>",
        ])
        #expect(entries.count == 2)
        #expect(entries.first?.url == "https://www.instagram.com/reel/AbC/")
        #expect(entries.first?.savedAt == 1_700_000_000_000)
        #expect(InspoURL.normalize("HTTPS://www.Instagram.com/p/Zz/") == InspoURL.normalize("https://instagram.com/p/Zz"))
    }

    @Test func groupsAndSortsRows() throws {
        let response: IdeaListResponse = try decode("""
        {"items":[{"id":"1","title":"b","status":"posted","pillar":null,"updatedAt":"2026-09-20T00:00:00Z"},
        {"id":"2","title":"a","status":"ready","pillar":"Craft","pillarId":"c","updatedAt":"2026-09-21T00:00:00Z"}]}
        """)
        let rows = response.items
        #expect(IdeaGrouping.groups(rows, by: .status).map(\.items.count) == [0, 0, 1, 1])
        #expect(IdeaGrouping.groups(rows, by: .pillar).map(\.label) == ["Craft", "No pillar"])
        #expect(IdeaGrouping.applyViewFilters(rows, ["status": ["ready"]]).map(\.id) == ["2"])
        #expect(IdeaSort().apply(rows).map(\.id) == ["2", "1"])
        var byTitle = IdeaSort()
        byTitle.toggle(.title)
        #expect(byTitle.apply(rows).map(\.id) == ["2", "1"])
    }
}
