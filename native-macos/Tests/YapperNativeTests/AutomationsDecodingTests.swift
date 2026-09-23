import Foundation
import Testing
@testable import YapperNative

struct AutomationsDecodingTests {
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try StudioJSONClient.decoder.decode(T.self, from: Data(json.utf8))
    }

    @Test func decodesARuleWithRuns() throws {
        let response = try decode(AutomationResponse.self, """
        {"available":true,
         "rule":{"id":"r1","version":3,"enabled":true,
           "settings":{"destinations":["youtube"],"stripHashtags":false,"reformatForYouTube":true},
           "sourceLabel":"kerem","accounts":[{"platform":"youtube","id":"UC1","label":"@kerem"}],
           "enabledAt":"2026-09-20T10:00:00.000Z","lastCheckedAt":"2026-09-23T08:00:00.000Z","error":null},
         "runs":[
           {"id":"u1","title":"Morning video","sourceUrl":"https://instagram.com/reel/x","status":"queued",
            "error":null,"createdAt":"2026-09-23T07:00:00.000Z",
            "schedules":[{"id":"s1","platform":"youtube","accountLabel":"@kerem","title":"Morning video",
              "scheduledFor":"2026-09-23T07:05:00.000Z","timezone":"UTC","status":"scheduled","error":null,
              "externalUrl":null,"contentItemId":"c1"}]},
           {"id":"u2","title":"Broken","sourceUrl":"javascript:x","status":"failed","error":"download_failed",
            "createdAt":"2026-09-22T07:00:00.000Z","schedules":[]}
         ]}
        """)
        #expect(response.available)
        #expect(response.setupAvailable == nil)
        #expect(response.rule?.settings.destinations == [.youtube])
        #expect(response.runs[0].schedules[0].status.deliveryLabel == "Waiting to send")
        #expect(response.runs[0].sourceURL != nil)
        #expect(response.runs[1].sourceURL == nil)
        #expect(response.runs[1].status == .failed)
        #expect(AutomationErrorCopy.message(forCode: "download_failed").hasPrefix("Instagram's video"))
        #expect(AutomationErrorCopy.message(forCode: "publish_failed").hasPrefix("Sending failed"))

        let draft = AutomationDraft(response)
        #expect(draft.version == 3 && draft.enabled)
    }

    @Test func decodesTheUnavailableServerShape() throws {
        let response = try decode(AutomationResponse.self, """
        {"available":false,"rule":null,"runs":[],"setupAvailable":false}
        """)
        #expect(response.setupAvailable == false)
        let draft = AutomationDraft(response)
        #expect(draft.settings == .defaults)
        #expect(draft.version == 0 && !draft.enabled)
    }

    @Test func decodesASaveAndARetry() throws {
        let saved = try decode(AutomationSaveResponse.self, """
        {"rule":{"id":"r1","version":4,"enabled":false,
          "settings":{"destinations":["youtube","tiktok"],"stripHashtags":true,"reformatForYouTube":true},
          "sourceLabel":null,"accounts":[],"enabledAt":null,"lastCheckedAt":null,"error":"instagram_reauth_required"}}
        """)
        #expect(saved.rule.version == 4)
        #expect(saved.rule.error == "instagram_reauth_required")
        #expect(try decode(AutomationRetryResponse.self, #"{"ok":true}"#).ok)
    }

    @Test func encodesTheSaveBody() throws {
        let body = AutomationSaveRequest(
            enabled: true, version: 2, settings: .defaults,
            expectedAccounts: ["instagram": "ig1", "youtube": "UC1"]
        )
        let json = try JSONSerialization.jsonObject(with: StudioJSONClient.encoder.encode(body)) as? [String: Any]
        let settings = json?["settings"] as? [String: Any]
        #expect(settings?["destinations"] as? [String] == ["youtube", "tiktok"])
        #expect((json?["expectedAccounts"] as? [String: String])?["instagram"] == "ig1")
    }

    @Test func decodesConnectionsWithAccountIds() throws {
        let response = try decode(AutomationConnectionsResponse.self, """
        {"connections":[
          {"platform":"instagram","handle":null,"status":"active","externalAccountId":"ig1","updatedAt":"2026-09-01T00:00:00.000Z"},
          {"platform":"tiktok","handle":"kerem","status":"reauth_required","externalAccountId":"tt1","updatedAt":"2026-09-01T00:00:00.000Z"}
        ],"available":["youtube","tiktok","instagram"]}
        """)
        #expect(response.connections[0].externalAccountId == "ig1")
        #expect(response.connections[1].status == "reauth_required")
    }
}
