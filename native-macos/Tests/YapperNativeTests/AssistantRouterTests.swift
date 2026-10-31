import Foundation
import Testing

@testable import YapperNative

/// The one sentence match left before Chirpy plans: brand setup.
@Suite struct AssistantRouterTests {
    @Test func brandSetupUsesTheStudioKitFromTheEditor() {
        #expect(AssistantRouter.requestsBrandKit("My colors are orange and black"))
        #expect(AssistantRouter.requestsBrandKit("Please create my brand kit with #123 and #456"))
        #expect(AssistantRouter.requestsBrandKit("Put up my brand kit"))
        #expect(AssistantRouter.requestsBrandKit("Add red to my brand colors"))
        #expect(!AssistantRouter.requestsBrandKit("Generate an overlay using my brand colors"))
        #expect(!AssistantRouter.requestsBrandKit("Make the caption color orange"))
    }

    /// Every intent says what it is about to do, because the box shows that back
    /// before the sentence is sent.
    @Test func everyIntentCanSayWhatItWillDo() {
        let intents: [AssistantIntent] = [
            .transcribe, .oneClickEdit, .trimSilences, .generateCaptions,
            .hideCaptions, .showCaptions, .addHook, .placeOverlays, .addSounds,
            .placeText, .setLevels, .unknown,
        ]
        for intent in intents {
            #expect(!intent.spoken.isEmpty)
        }
    }
}
