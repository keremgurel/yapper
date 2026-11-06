import Foundation
import Testing
@testable import YapperNative

/// Canvas saves that carry the copy they started from, the ask runner around
/// them, and the reload a Chirpy edit from another tab triggers.
@MainActor
struct IdeaCanvasSyncTests {
    /// Records each save's JSON and answers like the server: the sent fields
    /// back, or a scripted merged reply. `during` runs while the save is out.
    @MainActor
    final class Server {
        var bodies: [[String: Any]] = []
        var replies: [String] = []
        var during: (@MainActor () -> Void)?

        func transport(_ path: String, _ method: String, _ body: Data) async throws -> Data {
            let json = try JSONSerialization.jsonObject(with: body) as? [String: Any] ?? [:]
            bodies.append(json)
            during?()
            during = nil
            if !replies.isEmpty { return Data(replies.removeFirst().utf8) }
            var echoed = json
            echoed["base"] = nil
            let key = method == "PUT" ? "version" : "item"
            return try JSONSerialization.data(withJSONObject: [key: echoed, "rebased": false])
        }
    }

    private static let old = IdeaCanvasStoredBlock(label: "Script", kind: "script", text: "Old.")

    private func item(blocks: String = #"[{"label":"Script","kind":"script","text":"Old."}]"#) throws -> IdeaCanvasItem {
        let json = """
        {"item":{"id":"idea","title":"Gym myths","status":"drafting","hooks":["Stop."],
        "blocks":\(blocks),"script":"Old.","originalNote":"","leadFormat":"short"}}
        """
        return try JSONDecoder().decode(IdeaCanvasItemEnvelope.self, from: Data(json.utf8)).item
    }

    private func version() throws -> IdeaCanvasVersion {
        let json = #"{"format":"long","title":"Long","hooks":["Long hook"],"blocks":[{"label":"Script","kind":"script","text":"Old."}],"script":"Old."}"#
        return try JSONDecoder().decode(IdeaCanvasVersion.self, from: Data(json.utf8))
    }

    private func blocks(_ body: [String: Any], _ key: String = "blocks") -> [String] {
        (body[key] as? [[String: Any]] ?? []).map { ($0["text"] as? String) ?? (($0["items"] as? [String]) ?? []).joined() }
    }

    private func base(_ body: [String: Any]) -> [String] {
        blocks(body["base"] as? [String: Any] ?? [:])
    }

    @Test func aSaveSendsTheCopyItStartedFromAndThenTheSavedOne() async throws {
        let server = Server()
        let store = IdeaCanvasVersionStore(itemID: "idea", version: try version(), transport: server.transport)
        store.editBlocks { blocks in blocks.map { IdeaCanvasBlock(id: $0.id, label: $0.label, kind: $0.kind, text: "First.") } }
        try await store.autosave.flush()
        store.editBlocks { blocks in blocks.map { IdeaCanvasBlock(id: $0.id, label: $0.label, kind: $0.kind, text: "Second.") } }
        try await store.autosave.flush()
        #expect(base(server.bodies[0]) == ["Old."])
        #expect(blocks(server.bodies[0]) == ["First."])
        #expect(base(server.bodies[1]) == ["First."])
        #expect(server.bodies[0]["serverSaves"] == nil)
    }

    @Test func aMergedSaveIsShownKeepingTheIdsOfUnchangedBlocks() async throws {
        let server = Server()
        let store = IdeaCanvasVersionStore(itemID: "idea", version: try version(), transport: server.transport)
        let id = store.blocks[0].id
        store.editBlocks { blocks in blocks.map { IdeaCanvasBlock(id: $0.id, label: $0.label, kind: $0.kind, text: "Typed.") } }
        server.replies = [#"""
        {"version":{"title":"Long","hooks":["Long hook"],"script":"Typed.","blocks":[
          {"kind":"script","label":"Script","text":"Typed."},{"label":"Protein","kind":"bullets","items":["Eat"]}]},
         "rebased":true}
        """#]
        try await store.autosave.flush()
        #expect(store.blocks.map(\.label) == ["Script", "Protein"])
        #expect(store.blocks[0].id == id)
        #expect(!store.autosave.hasUnsaved)
    }

    @Test func typingDuringAMergedSaveStaysAndGoesNextOnTheSentCopy() async throws {
        let server = Server()
        let store = IdeaCanvasVersionStore(itemID: "idea", version: try version(), transport: server.transport)
        store.editBlocks { blocks in blocks.map { IdeaCanvasBlock(id: $0.id, label: $0.label, kind: $0.kind, text: "Typed.") } }
        server.replies = [#"{"version":{"blocks":[{"label":"Script","kind":"script","text":"Typed."},{"label":"Protein","kind":"bullets","items":["Eat"]}]},"rebased":true}"#]
        server.during = {
            store.editBlocks { blocks in blocks.map { IdeaCanvasBlock(id: $0.id, label: $0.label, kind: $0.kind, text: "Typed more.") } }
        }
        try await store.autosave.flush()
        #expect(store.blocks.map(\.text) == ["Typed more."])
        try await store.autosave.flush()
        #expect(blocks(server.bodies[1]) == ["Typed more."])
        #expect(base(server.bodies[1]) == ["Typed."])
    }

    @Test func anAskSavesPendingTypingFirstAndBasesTheNextSaveOnTheSavedReply() async throws {
        let server = Server()
        let store = IdeaCanvasItemStore(itemID: "idea", transport: server.transport, loaded: try item())
        let thread = IdeaCanvasThreadStore(itemID: "idea")
        store.setBlocks(store.blocks.map { IdeaCanvasBlock(id: $0.id, label: $0.label, kind: $0.kind, text: "Typed.") })
        var savedBeforeAsk = -1
        var sentBody: [String: Any] = [:]
        let runner = IdeaCanvasAskRunner(store: store, thread: thread) { body, _ in
            savedBeforeAsk = server.bodies.count
            sentBody = (try? JSONSerialization.jsonObject(with: StudioJSONClient.encoder.encode(body))) as? [String: Any] ?? [:]
            let reply = IdeaCanvasAskReply.parse(Data(#"""
            {"actions":[{"type":"replace","index":0,"block":{"label":"Script","kind":"script","text":"Tight."}}],
             "note":"Tightened it.","messages":[],
             "document":{"title":"Gym myths","hooks":["Stop."],"script":"Tight.","blocks":[{"label":"Script","kind":"script","text":"Tight."}]}}
            """#.utf8), blockCount: 1)
            return .success(reply)
        }
        await runner.run("tighten it")
        #expect(savedBeforeAsk == 1)
        #expect(sentBody["serverSaves"] as? Bool == true)
        #expect(store.blocks.map(\.text) == ["Tight."])
        try await store.autosave.flush()
        #expect(base(server.bodies.last ?? [:]) == ["Tight."])
    }

    @Test func typingDuringAnAskStaysAndIsMergedByTheNextSave() async throws {
        let server = Server()
        let store = IdeaCanvasItemStore(itemID: "idea", transport: server.transport, loaded: try item())
        let runner = IdeaCanvasAskRunner(store: store, thread: IdeaCanvasThreadStore(itemID: "idea")) { _, _ in
            store.setBlocks(store.blocks.map { IdeaCanvasBlock(id: $0.id, label: $0.label, kind: $0.kind, text: "Typed meanwhile.") })
            return .success(IdeaCanvasAskReply.parse(Data(#"""
            {"actions":[{"type":"replace","index":0,"block":{"label":"Script","kind":"script","text":"Tight."}}],
             "messages":[],"document":{"title":"Gym myths","hooks":["Stop."],"script":"Tight.","blocks":[{"label":"Script","kind":"script","text":"Tight."}]}}
            """#.utf8), blockCount: 1))
        }
        await runner.run("tighten it")
        #expect(store.blocks.map(\.text) == ["Typed meanwhile."])
        #expect(runner.lastReply?.contains("Your edits stay") == true)
        try await store.autosave.flush()
        // Based on the copy the ask started from, so the server merges the
        // typing into its saved reply instead of replacing it.
        #expect(base(server.bodies.last ?? [:]) == ["Old."])
        #expect(blocks(server.bodies.last ?? [:]) == ["Typed meanwhile."])
    }

    @Test func anAskThatRacedAnEditSaysNothingChanged() async throws {
        let store = IdeaCanvasItemStore(itemID: "idea", transport: Server().transport, loaded: try item())
        let runner = IdeaCanvasAskRunner(store: store, thread: IdeaCanvasThreadStore(itemID: "idea")) { _, _ in
            .failure(.changed)
        }
        await runner.run("tighten it")
        #expect(runner.error == .changed)
        #expect(runner.error?.message.contains("Nothing was charged") == true)
        #expect(store.blocks.map(\.text) == ["Old."])
    }

    final class Heard: @unchecked Sendable { var value = false }

    @Test func aChirpyCanvasEditFromAnotherTabTellsAnOpenCanvasToReload() async {
        let heard = Heard()
        let observer = NotificationCenter.default.addObserver(
            forName: .ideaCanvasChangedRemotely, object: nil, queue: nil
        ) { _ in heard.value = true }
        defer { NotificationCenter.default.removeObserver(observer) }
        StudioChirpyEffects.apply(["ideaCanvas"])
        #expect(heard.value)
    }

    @Test func aSaveBodyIsThePatchWithItsBase() throws {
        let body = IdeaCanvasSaveBody(
            patch: IdeaCanvasPatch(title: "New", blocks: [Self.old]),
            base: IdeaCanvasPatch(title: "Old")
        )
        let json = try JSONSerialization.jsonObject(with: StudioJSONClient.encoder.encode(body)) as? [String: Any]
        #expect(json?["title"] as? String == "New")
        #expect((json?["base"] as? [String: Any])?["title"] as? String == "Old")
        #expect((json?["blocks"] as? [Any])?.count == 1)
    }
}
