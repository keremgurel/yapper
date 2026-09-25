import Testing
@testable import YapperNative

struct IdeaCanvasNoteEditTests {
    @Test func wordsOnABareLinkMakeItSemiOriginal() {
        let patch = IdeaCanvasNoteEdit.patch(note: "End on the skill CTA", ideaType: "inspiration")
        #expect(patch.originalNote == "End on the skill CTA")
        #expect(patch.ideaType == "semi-original")
    }

    @Test func clearingTheNoteMakesItInspirationAgain() {
        #expect(IdeaCanvasNoteEdit.patch(note: "  \n", ideaType: "semi-original").ideaType == "inspiration")
    }

    @Test func anOriginalIdeaKeepsItsType() {
        #expect(IdeaCanvasNoteEdit.patch(note: "", ideaType: "original").ideaType == nil)
        #expect(IdeaCanvasNoteEdit.patch(note: "more", ideaType: "semi-original").ideaType == nil)
    }

    @Test func theNoteRidesTheSamePatch() {
        let merged = IdeaCanvasPatch(title: "A").merged(with: IdeaCanvasNoteEdit.patch(note: "n", ideaType: nil))
        #expect(merged.title == "A")
        #expect(merged.originalNote == "n")
        #expect(!merged.isEmpty)
    }
}
