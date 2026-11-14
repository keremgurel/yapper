import Testing
@testable import YapperNative

struct AssistantWorkingLineTests {
    @Test func theHeaderNamesTheStageTheEditorIsOn() {
        #expect(AssistantWorkingLine.text(status: "Designing overlay 2 of 3…") == "Designing overlay 2 of 3…")
        #expect(AssistantWorkingLine.text(status: "") == AssistantWorkingLine.fallback)
        #expect(AssistantWorkingLine.text(status: "  ") == AssistantWorkingLine.fallback)
        #expect(AssistantWorkingLine.text(status: "Ready") == AssistantWorkingLine.fallback)
    }
}
