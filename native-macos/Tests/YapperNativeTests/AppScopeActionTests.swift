import Foundation
import Testing
@testable import YapperNative

private actor MemoryDictionary: DictionaryStoring {
    private var saved: [DictionaryEntry] = []
    func entries() async -> [DictionaryEntry] { saved }
    func save(term: String, aliases: [String]) async throws -> [DictionaryEntry] {
        if let index = saved.firstIndex(where: { TranscriptionDictionary.key($0.term) == TranscriptionDictionary.key(term) }) {
            saved[index].aliases = TranscriptionDictionary.cleanAliases(aliases)
        } else {
            saved.append(DictionaryEntry(id: "e\(saved.count)", term: term, aliases: aliases))
        }
        return saved
    }
    func update(id: String, term: String, aliases: [String]) async -> [DictionaryEntry] {
        if let index = saved.firstIndex(where: { $0.id == id }) {
            saved[index] = DictionaryEntry(id: id, term: term, aliases: aliases)
        }
        return saved
    }
    func remove(id: String) async -> [DictionaryEntry] { saved.removeAll { $0.id == id }; return saved }
}

/// Library and dictionary actions: the controls and Chirpy run the same
/// executors, they run alone and outside Undo, a Chirpy trash asks first, and a
/// project change waits for the Chirpy turn that asked for it to finish.
@MainActor
struct AppScopeActionTests {
    private func session(plan: @escaping @Sendable () throws -> ChirpyPlanReply) async -> EditorSession {
        let session = EditorSession(store: ProjectStore(directory: FileManager.default.temporaryDirectory
            .appending(path: "app-scope-\(UUID().uuidString)", directoryHint: .isDirectory)))
        await Task.yield()
        session.dictionaryStore = MemoryDictionary()
        session.chirpyPlanner = { _ in try plan() }
        session.confirmAssistantAction = { _ in Issue.record("Asked without a confirm flag"); return false }
        return session
    }

    nonisolated private static func reply(_ inputs: [any AppActionInput]) throws -> ChirpyPlanReply {
        .init(message: "Planned", actions: try inputs.map { input in
            guard case .object(let fields) = try ActionJSON.encoding(input) else { throw AppActionError("bad test input") }
            return .init(action: type(of: input).actionID.rawValue, arguments: fields)
        })
    }

    private func settle(until done: @escaping () -> Bool) async {
        for _ in 0..<5000 where !done() { await Task.yield() }
    }

    @Test func dictionaryPanelAndChirpyLeaveTheSameEntries() async throws {
        let ui = await session { throw AppActionError("unused") }
        let chat = await session { try Self.reply([DictionaryAddInput(term: "Yapper", aliases: ["yaper", "yapa"])]) }
        await ui.addDictionaryTerm("  Yapper ", aliases: ["yaper", "yapa"])
        await chat.runAssistant(instruction: "add Yapper to my dictionary, it gets heard as yaper or yapa")
        #expect(ui.dictionaryEntries.map(\.term) == ["Yapper"])
        #expect(ui.dictionaryEntries.map(\.aliases) == chat.dictionaryEntries.map(\.aliases))
        let receipt = try #require(chat.appActions.recentResults.last)
        #expect(receipt.status == .applied && receipt.changes.first?.after == "Yapper")
        #expect(chat.conversation.messages.last?.tone == .done)

        await ui.removeDictionaryAlias("yapa", from: ui.dictionaryEntries[0])
        #expect(ui.dictionaryEntries[0].aliases == ["yaper"])
        await ui.removeDictionaryEntry(ui.dictionaryEntries[0])
        #expect(ui.dictionaryEntries.isEmpty)
    }

    @Test func editingAMissingTermIsRejectedWithoutSaving() async throws {
        let chat = await session { try Self.reply([DictionaryEditInput(term: "Nope", newTerm: "Yes", addAliases: nil, removeAliases: nil)]) }
        await chat.runAssistant(instruction: "respell Nope")
        let receipt = try #require(chat.appActions.recentResults.last)
        #expect(receipt.status == .rejected)
        #expect(receipt.message.contains("not in your dictionary"))
        #expect(await chat.dictionaryStore.entries().isEmpty)
    }

    @Test func chirpyRenamesTheProjectOnceItsTurnHasFinished() async throws {
        let chat = await session { try Self.reply([ProjectRenameInput(name: "Launch video \(UUID().uuidString.prefix(6))")]) }
        await chat.createProject(named: "Draft \(UUID().uuidString.prefix(6))")
        let before = chat.project.name
        await chat.runAssistant(instruction: "rename this project")
        let receipt = try #require(chat.appActions.recentResults.last)
        #expect(receipt.status == .applied)
        #expect(receipt.message.hasPrefix("Renaming the project to"))
        #expect(chat.conversation.messages.last?.tone == .done)
        await settle { chat.project.name != before }
        #expect(chat.project.name.hasPrefix("Launch video"))
        #expect(chat.projectNavigation.currentPackage?.displayName == chat.project.name)
        if let package = chat.projectNavigation.currentPackage { try? FileManager.default.removeItem(at: package.url) }
    }

    @Test func chirpyAsksBeforeTrashingAndCancelKeepsTheProject() async throws {
        let name = "Keep me \(UUID().uuidString.prefix(6))"
        var asked: [AppActionConfirmation] = []
        let chat = await session { throw AppActionError("replaced below") }
        await chat.createProject(named: name)
        let projectID = chat.project.id
        chat.chirpyPlanner = { _ in try Self.reply([ProjectTrashInput(projectID: projectID)]) }
        chat.confirmAssistantAction = { question in asked.append(question); return false }
        await chat.runAssistant(instruction: "delete this project")
        #expect(asked.map(\.title) == ["Move “\(name)” to the Trash?"])
        #expect(asked.first?.confirmLabel == "Move to Trash")
        let receipt = try #require(chat.appActions.recentResults.last)
        #expect(receipt.status == .canceled)
        for _ in 0..<50 { await Task.yield() }
        #expect(try await chat.library.listings().contains { $0.summary.id == projectID })
        #expect(chat.project.id == projectID)
        if let package = chat.projectNavigation.currentPackage { try? FileManager.default.removeItem(at: package.url) }
    }

    @Test func libraryAndDictionaryActionsRunAlone() async throws {
        let chat = await session {
            try Self.reply([DictionaryAddInput(term: "Yapper", aliases: nil),
                            CaptionVisibilityInput(visible: false)])
        }
        await chat.runAssistant(instruction: "add Yapper and hide captions")
        #expect(chat.appActions.recentResults.suffix(2).allSatisfy { $0.status == .rejected })
        #expect(chat.dictionaryEntries.isEmpty)
    }

    @Test func openingTheOpenProjectFromTheGridReturnsToIt() async throws {
        let ui = await session { throw AppActionError("unused") }
        await ui.createProject(named: "Open me \(UUID().uuidString.prefix(6))")
        ui.projectNavigation.showsProjectsHome = true
        let result = await ui.performAppAction(ProjectOpenInput(projectID: ui.project.id))
        #expect(result.status == .unchanged)
        #expect(!ui.projectNavigation.showsProjectsHome)
        if let package = ui.projectNavigation.currentPackage { try? FileManager.default.removeItem(at: package.url) }
    }
}
