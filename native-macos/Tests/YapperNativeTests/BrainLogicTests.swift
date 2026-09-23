import Foundation
import Testing
@testable import YapperNative

/// The Brain rules that run on this Mac: reading a paste and turning a
/// reviewed setup proposal into edits. Both mirror the web's code.
@Suite
struct BrainLogicTests {
    @Test("A CSV export with a header becomes a table")
    func csv() {
        let paste = BrainPasteDetector.detect("Keyword,Volume\ncelpip task 5,1200\ncelpip tips,880\n\"speaking, fast\",300")
        #expect(paste.kind == .table)
        #expect(paste.rows?.columns == ["Keyword", "Volume"])
        #expect(paste.rows?.rows.last == ["speaking, fast", "300"])
        #expect(paste.shape == "a table of 3 rows and 2 columns")
    }

    @Test("Prose with commas stays prose")
    func prose() {
        let paste = BrainPasteDetector.detect("I started posting in May, mostly at night.\nIt went badly, then it didn't.\nNow I post daily, which helps.")
        #expect(paste.kind == .note)
    }

    @Test("Bulleted lines become a list, en dash bullets included")
    func list() {
        let paste = BrainPasteDetector.detect("- Open on the mistake\n\u{2013} One idea per video\n1. Close with the next step")
        #expect(paste.kind == .list)
        #expect(paste.items == ["Open on the mistake", "One idea per video", "Close with the next step"])
    }

    @Test("A JSON array of records becomes a table with its keys in order")
    func json() {
        let paste = BrainPasteDetector.detect(#"[{"term":"task 5","volume":1200,"new":true},{"term":"tips","volume":880}]"#)
        #expect(paste.rows?.columns == ["term", "volume", "new"])
        #expect(paste.rows?.rows.first == ["task 5", "1200", "true"])
        #expect(paste.rows?.rows.last == ["tips", "880", ""])
    }

    @Test("A long paste becomes a document")
    func document() {
        let paste = BrainPasteDetector.detect(String(repeating: "A long research paragraph without structure. ", count: 50))
        #expect(paste.kind == .doc)
        #expect(paste.sample.count <= 2_003)
    }

    @Test("Adding pillars keeps the existing ones and fills matching names")
    func mergePillars() {
        let existing = [BrainPillarDraft(serverID: "p1", name: "Task 5", description: "", examples: [])]
        let merged = BrainSetupPlan.mergePillars(
            [BrainSetupPillar(name: "task 5", description: "Choices", examples: []),
             BrainSetupPillar(name: "Vocabulary", description: "Words", examples: ["10 words"])],
            existing: existing, mode: .add
        )
        #expect(merged.map(\.name) == ["Task 5", "Vocabulary"])
        #expect(merged[0].serverID == "p1" && merged[0].description == "Choices")
    }

    @Test("Only chosen parts of a proposal become edits")
    func projectEdits() {
        let proposal = BrainSetupProposal(
            essentials: ["name": "CELPIP with Kerem", "voice": "Warm"],
            pillars: [BrainSetupPillar(name: "Task 5", description: "", examples: [])],
            blocks: [BrainSetupBlock(title: "Origin", digest: "Why", body: "Story", tags: [], usage: "core")],
            notes: ""
        )
        var selection = BrainSetupSelection.everything(in: proposal, existingPillars: 0)
        selection.essentials.remove("voice")
        selection.pillars = []
        let edits = BrainSetupPlan.projectEdits(proposal, selection, existing: [])
        #expect(edits == [.name("CELPIP with Kerem")])
        #expect(BrainSetupPlan.blocks(proposal, selection).first?.usage == .core)
    }
}
