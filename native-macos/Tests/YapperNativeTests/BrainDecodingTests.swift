import Foundation
import Testing
@testable import YapperNative

/// Every Brain route reply, decoded from JSON shaped like the real routes
/// send it, extra columns included, so a server row gaining a field never
/// blanks the page.
@Suite
struct BrainDecodingTests {
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try StudioJSONClient.decoder.decode(T.self, from: Data(json.utf8))
    }

    @Test("The project and its pillars decode, ignoring columns the page never reads")
    func project() throws {
        let payload = try decode(BrainProjectPayload.self, """
        {"project":{"id":"7c9e6679-7425-40de-944b-e07fc1f90ae7","userId":"user_2abc","name":"CELPIP with Kerem",
        "whatIMake":"Short-form video for the speaking test.","audience":"Newcomers to Canada","voice":"Direct and warm.",
        "scriptingPatterns":"","offers":"The practice app","doNots":"No score guarantees","links":["https://ypr.app"],
        "brandColors":["#FF7A21"],"contextVersion":14,"createdAt":"2026-08-01T10:00:00.000Z","updatedAt":"2026-09-20T08:30:12.511Z"},
        "pillars":[{"id":"a1","projectId":"7c9e","name":"Task 5","description":"Choosing between two options","examples":["Task 5 in 60 seconds"],"sortOrder":0,"createdAt":"2026-08-01T10:00:00.000Z"}]}
        """)
        #expect(payload.project.name == "CELPIP with Kerem")
        #expect(payload.project[.doNots] == "No score guarantees")
        #expect(payload.pillars.first?.examples == ["Task 5 in 60 seconds"])
        #expect(BrainPillarDraft(payload.pillars[0]).serverID == "a1")
    }

    @Test("Blocks decode every kind, including a table and a null rows")
    func blocks() throws {
        let response = try decode(BrainBlocksResponse.self, """
        {"blocks":[
        {"id":"b1","projectId":"p","title":"Why I post","kind":"note","body":"Because it helps.","items":[],"rows":null,"digest":"",
         "usage":"core","tags":[],"sourceLabel":"","sourceUrl":"","charCount":17,"inContext":true,"sortOrder":0,
         "createdAt":"2026-09-01T00:00:00.000Z","updatedAt":"2026-09-01T00:00:00.000Z"},
        {"id":"b2","projectId":"p","title":"Keyword gaps","kind":"table","body":"","items":[],
         "rows":{"columns":["Keyword","Volume"],"rows":[["celpip task 5","1200"],["celpip speaking tips","880"]]},
         "digest":"Search terms with thin answers","usage":"auto","tags":["seo"],"sourceLabel":"gaps.csv","sourceUrl":"",
         "charCount":12340,"inContext":true,"sortOrder":1,"createdAt":"2026-09-01T00:00:00.000Z","updatedAt":"2026-09-01T00:00:00.000Z"}
        ]}
        """)
        #expect(response.blocks.count == 2)
        #expect(response.blocks[0].rows == nil)
        #expect(response.blocks[1].rows?.rows.count == 2)
        #expect(response.blocks[1].sizeLabel == "12k")
        #expect(response.blocks[0].shapeDescription == "note")
        #expect(response.blocks[1].shapeDescription == "table, 2 rows, 2 columns")
        let single = try decode(BrainBlockResponse.self, #"{"block":{"id":"b3","title":"Hooks","kind":"list","body":"","items":["Open on the mistake"],"rows":null,"digest":"","usage":"private","tags":[],"sourceLabel":"","sourceUrl":"","charCount":19,"sortOrder":2}}"#)
        #expect(single.block.usage == .private)
    }

    @Test("Skills, the catalog and an install reply decode")
    func skills() throws {
        let skills = try decode(BrainSkillsResponse.self, """
        {"skills":[{"id":"s1","projectId":"p","catalogSlug":"hook-shapes","catalogVersion":2,"name":"Hook shapes",
        "whenToUse":"Writing the first line","instructions":"Open on tension.","surfaces":["hooks","script"],
        "enabled":true,"customized":false,"sortOrder":0,"createdAt":"2026-09-01T00:00:00.000Z","updatedAt":"2026-09-01T00:00:00.000Z"},
        {"id":"s2","projectId":"p","catalogSlug":null,"catalogVersion":null,"name":"New skill","whenToUse":"","instructions":"",
        "surfaces":[],"enabled":false,"customized":false,"sortOrder":1,"createdAt":"2026-09-01T00:00:00.000Z","updatedAt":"2026-09-01T00:00:00.000Z"}]}
        """)
        #expect(skills.skills[0].isStarter)
        #expect(!skills.skills[1].isStarter)

        let catalog = try decode(BrainCatalogResponse.self, """
        {"entries":[{"slug":"storytime-three-acts","version":3,"kind":"skill","name":"Storytime in three acts",
        "tagline":"For personal stories","whenToUse":"A personal story","instructions":"Act one...","surfaces":["script"],
        "category":"Scripts","installedVersion":2,"customized":true},
        {"slug":"audience-worksheet","version":1,"kind":"context","name":"Audience worksheet","tagline":"Questions about who watches",
        "whenToUse":"","instructions":"Who are they?","surfaces":[],"category":"","installedVersion":null,"customized":false}]}
        """)
        #expect(catalog.entries[0].updateAvailable)
        #expect(!catalog.entries[0].resettable)
        #expect(catalog.entries[1].isContext && !catalog.entries[1].installed)

        let install = try decode(BrainInstallResponse.self, #"{"block":{"id":"b9","title":"Audience worksheet","kind":"note","body":"Who are they?","items":[],"rows":null,"digest":"Questions","usage":"manual","tags":[],"sourceLabel":"From the catalog","sourceUrl":"","charCount":13,"sortOrder":4}}"#)
        #expect(install.skill == nil && install.block?.usage == .manual)
    }

    @Test("The preview decodes with its budget and entries")
    func preview() throws {
        let preview = try decode(BrainPreview.self, """
        {"surface":"script","budget":{"core":2000,"index":800,"loaded":2600},"core":"## Who you are","index":"- Hooks",
        "loaded":"","section":"## Who you are\\n- Hooks","used":{"skills":["Hook shapes"],"context":[]},
        "entries":[{"ref":"s1","id":"s1","type":"skill","line":"Hook shapes: writing the first line","loaded":true}]}
        """)
        #expect(preview.budget.loaded == 2600)
        #expect(BrainPreview.length(preview.core) == 14)
        #expect(preview.entries.first?.loaded == true)
    }

    @Test("A setup proposal decodes with only the covered essentials")
    func setup() throws {
        let response = try decode(BrainSetupResponse.self, """
        {"proposal":{"essentials":{"name":"CELPIP with Kerem","voice":"Warm, fast"},
        "pillars":[{"name":"Task 5","description":"Choices","examples":["60 second answer"]}],
        "blocks":[{"title":"Origin story","digest":"Why the channel exists","body":"I failed once.","tags":["story"],"usage":"core"}],
        "notes":"Nothing about offers."},"balance":41}
        """)
        #expect(response.proposal.coveredKeys == [.name, .voice])
        #expect(response.proposal.blocks.first?.usage == "core")
    }

    @Test("Voice samples, a new sample and channel videos decode")
    func voice() throws {
        let samples = try decode(BrainVoiceSamplesResponse.self, """
        {"samples":[{"id":"0b8f4a53-0000-4000-8000-000000000001","platform":"tiktok","externalPostId":"739","url":"https://tiktok.com/@k/video/739",
        "title":"Task 5 fast","thumbnail":null,"publishedAt":"2026-09-01T12:00:00.000Z","durationSec":61.4,
        "transcript":"So here's the thing.","creditsCharged":1,"createdAt":"2026-09-02T12:00:00.000Z"}]}
        """)
        #expect(samples.samples?.first?.durationSec == 61.4)
        #expect(try decode(BrainVoiceSamplesResponse.self, "{}").samples == nil)

        let added = try decode(BrainVoiceSampleResponse.self, """
        {"sample":{"id":"x","platform":"youtube","externalPostId":"yt1","url":"","title":"","thumbnail":"https://i.ytimg.com/a.jpg",
        "publishedAt":null,"durationSec":null,"transcript":"hi","creditsCharged":0,"createdAt":"2026-09-02T12:00:00.000Z"},"charged":0,"balance":40}
        """)
        #expect(added.charged == 0)

        let videos = try decode(BrainChannelVideosResponse.self, """
        {"connected":true,"videos":[{"id":"yt1","title":"Task 5","thumbnail":"https://i.ytimg.com/a.jpg","viewCount":1200,
        "publishedAt":"2026-09-01T12:00:00Z","privacyStatus":"public","url":"https://youtube.com/shorts/yt1","durationSec":58}]}
        """)
        #expect(videos.videos.first?.durationSec == 58)
    }

    @Test("A naming proposal decodes")
    func ingest() throws {
        let response = try decode(BrainIngestResponse.self, #"{"proposal":{"title":"Keyword gaps","digest":"Use when picking a topic","tags":["seo"],"usage":"auto","sourceLabel":"TikTok search"},"balance":12}"#)
        #expect(response.proposal.usage == .auto)
    }

    @Test("Edits encode as the partial JSON the routes expect")
    func patches() throws {
        let data = try StudioJSONClient.encoder.encode(BrainProjectEdit.pillars([BrainPillarDraft(name: "Task 5")]).patch)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let pillars = object?["pillars"] as? [[String: Any]]
        #expect(pillars?.first?["name"] as? String == "Task 5")
        #expect(pillars?.first?["id"] == nil)
        #expect(BrainSkillEdit.enabled(false).patch == ["enabled": .bool(false)])
    }
}
