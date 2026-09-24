import Foundation
import Testing
@testable import YapperNative

/// The canvas action rules, ported from `lib/content/canvas-actions.ts`.
struct IdeaCanvasActionsTests {
    private let script = IdeaCanvasBlock(id: "s", label: "Script", kind: .script, text: "Old")
    private let points = IdeaCanvasBlock(id: "p", label: "Key points", kind: .bullets, items: ["a"])

    private func state() -> IdeaCanvasState {
        IdeaCanvasState(title: "Piece", blocks: [script, points], hooks: ["h1"])
    }

    @Test func replaceKeepsIdentityAndTheLabelWhenBlank() {
        let next = IdeaCanvasActions.apply(state(), [
            .replace(index: 0, block: IdeaCanvasBlockInput(label: "", kind: .script, text: "New")),
        ])
        #expect(next.blocks[0].id == "s")
        #expect(next.blocks[0].label == "Script")
        #expect(next.blocks[0].text == "New")
    }

    @Test func indexesPointAtTheDocumentAsItWasAsked() {
        let next = IdeaCanvasActions.apply(state(), [
            .insert(after: nil, block: IdeaCanvasBlockInput(label: "Intro", kind: .paragraph, text: "x")),
            .replace(index: 1, block: IdeaCanvasBlockInput(label: "Points", kind: .bullets, items: ["b"])),
            .insert(after: 0, block: IdeaCanvasBlockInput(label: "After script", kind: .paragraph, text: "y")),
            .append(block: IdeaCanvasBlockInput(label: "End", kind: .paragraph, text: "z")),
        ])
        #expect(next.blocks.map(\.label) == ["Intro", "Script", "After script", "Points", "End"])
        #expect(next.blocks[3].id == "p")
        #expect(next.blocks[3].items == ["b"])
    }

    @Test func hooksAppendOrReplaceAndTitleRenames() {
        let appended = IdeaCanvasActions.apply(state(), [.hooks(options: ["h2"], replace: false), .title("New")])
        #expect(appended.hooks == ["h1", "h2"])
        #expect(appended.title == "New")
        let replaced = IdeaCanvasActions.apply(state(), [.hooks(options: ["x"], replace: true)])
        #expect(replaced.hooks == ["x"])
    }

    @Test func noActionsLeaveTheStateAlone() {
        #expect(IdeaCanvasActions.apply(state(), []) == state())
    }

    @Test func describeSaysWhatChanged() {
        #expect(IdeaCanvasActions.describe([]) == "No changes.")
        #expect(IdeaCanvasActions.describe([
            .replace(index: 2, block: IdeaCanvasBlockInput(label: "", kind: .paragraph, text: "x")),
            .append(block: IdeaCanvasBlockInput(label: "Objections", kind: .bullets, items: ["a"])),
            .insert(after: nil, block: IdeaCanvasBlockInput(label: "", kind: .paragraph, text: "x")),
            .hooks(options: ["a"], replace: false),
            .hooks(options: ["a", "b"], replace: false),
            .hooks(options: ["a", "b", "c"], replace: true),
            .title("Take two"),
        ]) == "Rewrote block 3. Added Objections. Added a block. Added 1 hook. Added 2 hooks. "
            + "Replaced the hooks with 3 new ones. Renamed the piece to \"Take two\".")
    }

    @Test func theParserDropsWhatItCannotTrust() {
        let raw: [String: Any] = ["actions": [
            ["type": "replace", "index": 5, "block": ["kind": "paragraph", "text": "x"]],
            ["type": "replace", "index": 1.5, "block": ["kind": "paragraph", "text": "x"]],
            ["type": "insert", "after": NSNull(), "block": ["label": "A", "items": ["one", " "]]],
            ["type": "insert", "after": 9, "block": ["text": "x"]],
            ["type": "append", "block": ["kind": "steps", "text": "one\n two\n\n"]],
            ["type": "append", "block": ["kind": "paragraph"]],
            ["type": "hooks", "options": ["", "Hook \u{2014} with a pause"], "replace": 1],
            ["type": "title", "title": "  "],
            ["type": "delete", "index": 0],
        ]]
        let actions = IdeaCanvasActionParser.parse(raw, blockCount: 2)
        #expect(actions == [
            .insert(after: nil, block: IdeaCanvasBlockInput(label: "A", kind: .bullets, items: ["one"])),
            .append(block: IdeaCanvasBlockInput(label: "", kind: .steps, items: ["one", "two"])),
            .hooks(options: ["Hook, with a pause"], replace: false),
        ])
    }

    @Test func theParserCapsTheNumberOfActions() {
        let many = (0..<20).map { _ in ["type": "title", "title": "t"] as [String: Any] }
        #expect(IdeaCanvasActionParser.parse(["actions": many], blockCount: 0).count == 12)
    }

    @Test func undashTurnsDashesIntoCommasAndRanges() {
        #expect(IdeaCanvasUndash.apply("5\u{2013}10 reps") == "5 to 10 reps")
        #expect(IdeaCanvasUndash.apply("Stop \u{2014} breathe.") == "Stop, breathe.")
        #expect(IdeaCanvasUndash.apply("Wait \u{2014}.") == "Wait.")
    }

    @Test func theDocMirrorsTheFirstScript() {
        let blocks = IdeaCanvasDoc.blocks(
            from: [IdeaCanvasStoredBlock(label: "Notes", kind: "paragraph", text: "n")], script: "Legacy script"
        )
        #expect(blocks.map(\.kind) == [.script, .paragraph])
        let patch = IdeaCanvasDoc.patch(from: blocks)
        #expect(patch.script == .value("Legacy script"))
        #expect(patch.blocks?[0] == IdeaCanvasStoredBlock(label: "Script", kind: "script", text: "Legacy script"))
        #expect(IdeaCanvasDoc.patch(from: []).script == .null)
    }

    @Test func changingKindKeepsTheWords() {
        let blocks = [IdeaCanvasBlock(id: "a", label: "L", kind: .paragraph, text: "one\n two \n\nthree")]
        let listed = IdeaCanvasDoc.changeKind(blocks, id: "a", to: .bullets)
        #expect(listed[0].items == ["one", "two", "three"])
        let back = IdeaCanvasDoc.changeKind(listed, id: "a", to: .paragraph)
        #expect(back[0].text == "one\ntwo\nthree")
    }

    @Test func noteToBlockReadsListsAndLabelsFromTheAsk() {
        let list = IdeaCanvasNoteToBlock.block(note: "- first\n- second\n- third", asked: "What are the key points here?")
        #expect(list == IdeaCanvasBlockInput(label: "Key points here", kind: .bullets, items: ["first", "second", "third"]))
        let steps = IdeaCanvasNoteToBlock.block(note: "1. Open\n2) Close", asked: "list steps")
        #expect(steps.kind == .steps)
        let prose = IdeaCanvasNoteToBlock.block(note: "Just talk slower.", asked: "")
        #expect(prose == IdeaCanvasBlockInput(label: "Notes", kind: .paragraph, text: "Just talk slower."))
    }

    @Test func textRules() {
        #expect(IdeaCanvasText.wordCount("  one two\nthree ") == 3)
        #expect(IdeaCanvasText.speakingTime(words: 150) == "1:00")
        #expect(IdeaCanvasText.speakingTime(words: 40) == "0:16")
        #expect(IdeaCanvasText.hookKeys(["a", "b", "a"]) == ["a#0", "b#0", "a#1"])
    }
}
