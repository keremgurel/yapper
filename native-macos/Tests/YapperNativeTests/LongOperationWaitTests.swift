import Testing
@testable import YapperNative

/// A refusal names what holds the editor, never just "the current operation".
struct LongOperationWaitTests {
    @Test(arguments: [LongOperation.importingMedia, .autoTrim, .transcribing, .overlayAI, .recoveringMedia])
    func everyOperationSaysWhatToWaitFor(_ operation: LongOperation) {
        #expect(!operation.waitMessage.contains("current operation"))
        #expect(operation.waitMessage.hasPrefix("Wait"))
    }

    @Test func theImportIsNamed() {
        #expect(LongOperation.importingMedia.waitMessage == "Wait for the media import to finish.")
    }
}
