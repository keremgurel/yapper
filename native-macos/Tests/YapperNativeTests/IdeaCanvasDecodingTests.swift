import Foundation
import Testing
@testable import YapperNative

/// Every reply the idea canvas reads, decoded from realistic route output.
struct IdeaCanvasDecodingTests {
    private func data(_ json: String) -> Data { Data(json.utf8) }

    @Test func anItemDecodesWithObjectAndLegacyHooks() throws {
        let json = """
        {"item":{"id":"5b1f3c9e-8a2d-4e11-9f3a-2c7d1e6b0a44","userId":"user_2abc","projectId":"p1",
        "stage":"library","title":"Why your first take is always stiff","status":"drafting",
        "formats":["short","article"],"ideaType":"semi-original","scheduledFor":null,
        "submissionId":null,"pillar":null,"pillarId":"a0e1c2d3-0000-4000-8000-000000000001",
        "sourceUrl":"https://www.tiktok.com/@coach/video/123","sourceTitle":"Camera nerves",
        "sourcePlatform":"tiktok","transcriptStatus":"ready",
        "hooks":[{"text":"Your first take is a warm-up.","pattern":"reframe","why":"flips a belief"},"Nobody nails take one."],
        "blocks":[{"label":"Script","kind":"script","text":"Hit record twice."},
                  {"label":"Key points","kind":"bullets","items":["Warm up","Talk to one person"]}],
        "script":"Hit record twice.","originalNote":"first takes are stiff","format":null,"summary":null,
        "sourceTranscript":"so the thing about the camera","recordedTranscript":null,"sourceSummary":null,
        "sourceReferenceType":"video","points":[],"example":"","cta":"",
        "createdAt":"2026-09-20T10:00:00.000Z","updatedAt":"2026-09-22T12:30:00.000Z"}}
        """
        let item = try JSONDecoder().decode(IdeaCanvasItemEnvelope.self, from: data(json)).item
        #expect(item.title == "Why your first take is always stiff")
        #expect(item.status == .drafting)
        #expect(item.formats == ["short", "article"])
        #expect(item.hooks == ["Your first take is a warm-up.", "Nobody nails take one."])
        #expect(item.blocks.count == 2)
        #expect(item.blocks[1].items == ["Warm up", "Talk to one person"])
        #expect(item.pillarId == "a0e1c2d3-0000-4000-8000-000000000001")
        #expect(item.hasOrigin)
    }

    @Test func aSparseItemFallsBackToDefaults() throws {
        let json = #"{"item":{"id":"x","status":"archived","hooks":[],"blocks":[]}}"#
        let item = try JSONDecoder().decode(IdeaCanvasItemEnvelope.self, from: data(json)).item
        #expect(item.status == .captured)
        #expect(item.title.isEmpty)
        #expect(!item.hasOrigin)
    }

    @Test func thePillarsComeOutOfTheProject() throws {
        let json = """
        {"project":{"id":"p1","name":"Speaking","whatIMake":"","audience":"","contextVersion":3},
         "pillars":[{"id":"a1","name":"Camera confidence","description":"","examples":[],"sortOrder":0},
                    {"id":"a2","name":"Storytelling","description":"hooks","examples":["x"],"sortOrder":1}]}
        """
        let response = try JSONDecoder().decode(IdeaCanvasProjectResponse.self, from: data(json))
        #expect(response.pillars.map(\.name) == ["Camera confidence", "Storytelling"])
    }

    @Test func thePhoneTicketDecodes() throws {
        let json = #"{"url":"https://ypr.app/studio/handoff?ticket=abc&to=%2Fstudio%2Frecorder","expiresInSeconds":180}"#
        let ticket = try JSONDecoder().decode(IdeaCanvasPhoneTicket.self, from: data(json))
        #expect(ticket.expiresInSeconds == 180)
        #expect(ticket.url.hasPrefix("https://ypr.app/studio/handoff"))
    }

    @Test func theThreadDecodesWithItsActions() throws {
        let json = """
        {"messages":[
          {"id":"m1","role":"creator","text":"Give me five hooks","actions":[],"createdAt":"2026-09-22T12:00:00.000Z"},
          {"id":"m2","role":"chirpy","text":"Five openers, each a different angle.",
           "actions":[{"type":"hooks","options":["One","Two"],"replace":false}],"createdAt":"2026-09-22T12:00:04.000Z"},
          {"id":"bad","role":"chirpy"}
        ]}
        """
        let messages = try #require(IdeaCanvasMessage.parseList(data(json)))
        #expect(messages.count == 2)
        #expect(messages[0].role == .creator)
        #expect(messages[1].actions == [.hooks(options: ["One", "Two"], replace: false)])
    }

    @Test func anAskReplyDecodesActionsNoteAndSavedExchange() {
        let json = """
        {"actions":[{"type":"replace","index":0,"block":{"label":"","kind":"script","text":"New words"}},
                    {"type":"replace","index":7,"block":{"label":"x","kind":"paragraph","text":"stale"}},
                    {"type":"title","title":"Take two"}],
         "note":"Tightened the script.","balance":41,"used":{"skills":["hooks"],"context":[]},
         "messages":[{"id":"m3","role":"creator","text":"tighten it","actions":[],"createdAt":"2026-09-22T12:01:00.000Z"},
                     {"id":"m4","role":"chirpy","text":"Tightened the script.","actions":[],"createdAt":"2026-09-22T12:01:03.000Z"}]}
        """
        let reply = IdeaCanvasAskReply.parse(data(json), blockCount: 2)
        #expect(reply.actions == [
            .replace(index: 0, block: IdeaCanvasBlockInput(label: "", kind: .script, text: "New words")),
            .title("Take two"),
        ])
        #expect(reply.note == "Tightened the script.")
        #expect(reply.chirpyMessage?.id == "m4")
    }

    @Test func thePatchSendsOnlyWhatChangedAndClearsWithNull() throws {
        var patch = IdeaCanvasPatch(title: "A")
        patch = patch.merged(with: IdeaCanvasPatch(pillarId: .null, script: .value("Words")))
        let object = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(patch)) as? [String: Any])
        #expect(Set(object.keys) == ["title", "pillarId", "script"])
        #expect(object["pillarId"] is NSNull)
        #expect(object["script"] as? String == "Words")
    }

    @Test func theAskBodyMatchesTheWebRequest() throws {
        let context = IdeaCanvasAskContext(
            title: "T", blocks: [IdeaCanvasBlock(label: "Script", kind: .script, text: "Hi")],
            hooks: Array(repeating: "h", count: 10), originalNote: "note",
            sourceTitle: nil, sourceURL: "https://x.test", sourceExcerpt: "words"
        )
        let body = IdeaCanvasAskBody(instruction: "  Write the script ", context: context, target: nil, contentID: "c1")
        let object = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(body)) as? [String: Any])
        #expect(object["instruction"] as? String == "Write the script")
        #expect((object["hooks"] as? [String])?.count == 8)
        #expect(object["target"] is NSNull)
        #expect(object["contentId"] as? String == "c1")
        #expect((object["blocks"] as? [[String: Any]])?.first?["text"] as? String == "Hi")
    }
}
