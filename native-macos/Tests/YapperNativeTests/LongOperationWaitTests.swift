import Testing
@testable import YapperNative

/// A refusal names what holds the editor, never just "the current operation".
struct LongOperationWaitTests {
    @Test(arguments: [LongOperation.importingMedia, .exporting, .transcribing, .overlayAI, .recoveringMedia])
    func everyOperationSaysWhatToWaitFor(_ operation: LongOperation) {
        #expect(!operation.waitMessage.contains("current operation"))
        #expect(operation.waitMessage.hasPrefix("Wait"))
    }

    @Test func theExportIsNamed() {
        #expect(LongOperation.exporting.waitMessage == "Wait for the export to finish.")
    }
}
