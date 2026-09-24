import Foundation
import Testing
@testable import YapperNative

/// The Recorder reads the same JSON the web recorder does.
struct RecorderDecodingTests {
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try StudioJSONClient.decoder.decode(T.self, from: Data(json.utf8))
    }

    @Test func aContentDetailDecodesWithEveryFieldTheRouteSends() throws {
        let json = """
        {"item":{"id":"8b1f0c7e-3a52-4c1e-9d6f-0a2b3c4d5e6f","userId":"user_2abc","projectId":"p1",
        "title":"Why your hooks fail","status":"drafted","stage":"library","formats":["short"],
        "ideaType":"original","scheduledFor":null,"submissionId":null,"pillar":null,"pillarId":null,
        "sourceUrl":null,"sourceTitle":null,"sourcePlatform":null,"transcriptStatus":null,
        "script":"Most hooks fail in the first second.\\nHere is why.",
        "originalNote":"hooks idea","updatedAt":"2026-09-20T10:00:00.000Z","createdAt":"2026-09-19T10:00:00.000Z",
        "hooks":[{"text":"Your hook is too slow","pattern":"callout","why":"names the pain"},{"text":"Stop opening with hi","pattern":null,"why":null}],
        "blocks":[{"label":"Beats","kind":"bullets","items":["Open on the result"," Cut the intro "]},
                  {"label":"Example","kind":"paragraph","text":"Show a before and after."},
                  {"label":"Script","kind":"script","text":"Read me verbatim"}],
        "format":null,"summary":null,"sourceTranscript":null,"recordedTranscript":null,"sourceSummary":null,
        "sourceReferenceType":null,"points":[],"example":"","cta":""}}
        """
        let item = try decode(RecorderContentEnvelope.self, json).item
        #expect(item.id == "8b1f0c7e-3a52-4c1e-9d6f-0a2b3c4d5e6f")
        #expect(item.hooks.count == 2)
        #expect(item.blocks.count == 3)
        #expect(TeleprompterText.build(item, view: .script) == "Most hooks fail in the first second.\nHere is why.")
        #expect(TeleprompterText.build(item, view: .notes)
            == "Your hook is too slow\n\n• Open on the result\n• Cut the intro\nShow a before and after.")
        #expect(TeleprompterText.build(item, view: .off).isEmpty)
        #expect(TeleprompterSource.item(item).defaultView == .script)
    }

    @Test func legacyStringHooksAndMissingScriptFallBackToTheBeats() throws {
        let json = """
        {"item":{"id":"a1","title":"","hooks":["  First hook  "],"blocks":[],"script":null}}
        """
        let item = try decode(RecorderContentEnvelope.self, json).item
        #expect(item.hooks.first?.text == "  First hook  ")
        #expect(TeleprompterText.build(item, view: .script) == "First hook")
        #expect(TeleprompterSource.item(item).defaultView == .notes)
        let empty = RecorderContentItem(id: "b2", title: "Nothing yet")
        #expect(TeleprompterSource.item(empty).defaultView == .off)
        #expect(!TeleprompterSource.item(empty).has(.script))
    }

    @Test func theContentListDecodes() throws {
        let json = """
        {"items":[{"id":"c1","title":"Morning routine","status":"drafted","stage":"bank","formats":[],
        "ideaType":null,"scheduledFor":null,"submissionId":null,"pillar":"Habits","pillarId":null,
        "sourceUrl":null,"sourceTitle":null,"sourcePlatform":null,"transcriptStatus":null,
        "script":"  ","originalNote":"","updatedAt":"2026-09-21T08:00:00.000Z","createdAt":"2026-09-21T08:00:00.000Z"},
        {"id":"c2","title":"Recorded one","status":"recorded","stage":"library","formats":["short"],
        "ideaType":"original","scheduledFor":null,"submissionId":"s9","pillar":null,"pillarId":null,
        "sourceUrl":null,"sourceTitle":null,"sourcePlatform":null,"transcriptStatus":"ready",
        "script":"Hello","originalNote":"x","updatedAt":"2026-09-22T08:00:00.000Z","createdAt":"2026-09-21T08:00:00.000Z"}]}
        """
        let items = try decode(RecorderContentListResponse.self, json).items
        #expect(items.map(\.id) == ["c1", "c2"])
        #expect(!items[0].hasScript)
        #expect(items[1].hasScript)
        #expect(items[1].submissionId == "s9")
    }



}
