import Foundation
import Testing
@testable import YapperNative

private actor ChirpyAcceptanceStore: ProjectPersisting {
    let url: URL
    init(_ url: URL) { self.url = url }
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(project).write(to: url, options: .atomic)
    }
}

/// Opt-in acceptance against a real project. Only the separate output directory
/// is written. Capture context first, evaluate it on the server, then supply the
/// returned plan to exercise the native executor against the same project.
@MainActor
struct ChirpyProjectAcceptanceTests {
    @Test(.enabled(if: ProcessInfo.processInfo.environment["CHIRPY_QA_PROJECT"] != nil))
    func revealSoundRequestAgainstSavedProject() async throws {
        let env = ProcessInfo.processInfo.environment
        let source = URL(fileURLWithPath: try #require(env["CHIRPY_QA_PROJECT"]))
        let output = URL(fileURLWithPath: try #require(env["CHIRPY_QA_OUTPUT"]))
        guard output.standardizedFileURL != source.deletingLastPathComponent().standardizedFileURL else { throw AppActionError("Use a separate QA output directory.") }
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        let originalBytes = try Data(contentsOf: source)
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        let original = try decoder.decode(EditorProject.self, from: originalBytes)
        let session = EditorSession(store: ChirpyAcceptanceStore(output.appending(path: "project-after.json")), generatedAssetRoot: output)
        await Task.yield()
        session.updateProject { $0 = original }
        session.projectNavigation.currentPackage = ProjectPackage(url: output)
        let events = try await session.revealEvents()
        #expect(!events.isEmpty)
        session.chirpyPlanner = { payload in
            try JSONEncoder().encode(payload).write(to: output.appending(path: "context.json"), options: .atomic)
            guard let planPath = env["CHIRPY_QA_PLAN"] else { return .init(message: "Context captured.", actions: []) }
            return try JSONDecoder().decode(ChirpyPlanReply.self, from: Data(contentsOf: URL(fileURLWithPath: planPath)))
        }
        await session.runAssistant(instruction: "add click sound effects when we reveal the clicks and cost")
        if env["CHIRPY_QA_PLAN"] != nil {
            #expect(session.conversation.messages.last?.tone == .done)
            #expect(session.project.overlays == original.overlays)
            #expect(session.project.media == original.media)
            let beforeIDs = Set((original.audioLayers ?? []).map(\.id))
            let added = (session.project.audioLayers ?? []).filter { !beforeIDs.contains($0.id) }
            #expect(added.count == 2)
            #expect(added.allSatisfy { $0.builtInID == "mouse-click" })
            #expect(added.allSatisfy { sound in events.contains { abs($0.timelineTime - sound.timelineStart) < 0.00001 } })
            #expect(try Data(contentsOf: source) == originalBytes)
        }
        session.player.replaceCurrentItem(with: nil)
    }
}
