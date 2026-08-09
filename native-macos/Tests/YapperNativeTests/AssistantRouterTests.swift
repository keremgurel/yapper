import Foundation
import Testing

@testable import YapperNative

/// Which command a sentence asks for.
///
/// Every answer here runs a real edit on somebody's video, so a wrong one is
/// worse than no answer at all — which is why `unknown` exists and why these
/// cover the phrasings a creator actually uses rather than the ones the matcher
/// was written against.
@Suite struct AssistantRouterTests {
    @Test func itHearsARequestToTranscribe() {
        #expect(AssistantRouter.route("transcribe this") == .transcribe)
        #expect(AssistantRouter.route("get me a transcript") == .transcribe)
        #expect(AssistantRouter.route("I need timed words") == .transcribe)
    }

    @Test func itHearsARequestForTheWholeTreatment() {
        #expect(AssistantRouter.route("1-click edit") == .oneClickEdit)
        #expect(AssistantRouter.route("clean this up") == .oneClickEdit)
        #expect(AssistantRouter.route("edit the video") == .oneClickEdit)
        #expect(AssistantRouter.route("cut out my retakes") == .oneClickEdit)
        #expect(AssistantRouter.route("remove the mistakes") == .oneClickEdit)
    }

    @Test func itHearsARequestToTrimSilences() {
        #expect(AssistantRouter.route("trim the silences") == .trimSilences)
        #expect(AssistantRouter.route("cut the dead air") == .trimSilences)
        #expect(AssistantRouter.route("remove long pauses") == .trimSilences)
    }

    @Test func itHearsARequestForCaptions() {
        #expect(AssistantRouter.route("add captions") == .generateCaptions)
        #expect(AssistantRouter.route("subtitle this") == .generateCaptions)
    }

    /// Turning captions off is a different job from making them, and the word
    /// they share must not send one to the other.
    @Test func itTellsCaptionsOffFromCaptionsOn() {
        #expect(AssistantRouter.route("hide the captions") == .hideCaptions)
        #expect(AssistantRouter.route("turn off captions") == .hideCaptions)
        #expect(AssistantRouter.route("show the captions again") == .showCaptions)
        #expect(AssistantRouter.route("bring back my captions") == .showCaptions)
    }

    @Test func itHearsARequestForAHook() {
        #expect(AssistantRouter.route("add a hook") == .addHook)
        #expect(AssistantRouter.route("put a title card on it") == .addHook)
    }

    @Test func itHearsARequestToPlaceOverlays() {
        #expect(AssistantRouter.route("show the b-roll over the intro") == .placeOverlays)
        #expect(AssistantRouter.route("put my cutaways in") == .placeOverlays)
    }

    /// Naming a file settles it, whatever else the sentence says. Asking to
    /// "clean up @01-hook.png" is about that file, not about a one-click pass.
    @Test func namingAFileAlwaysMeansPlaceIt() {
        #expect(
            AssistantRouter.route("clean this up with @01-hook.png", mentionsFile: true)
                == .placeOverlays
        )
        #expect(
            AssistantRouter.route("@01-hook.png while I talk", mentionsFile: true)
                == .placeOverlays
        )
    }

    /// Better to say it does not know than to guess and run something
    /// destructive on a video.
    @Test func itAdmitsWhenItDoesNotKnow() {
        #expect(AssistantRouter.route("make it go viral") == .unknown)
        #expect(AssistantRouter.route("") == .unknown)
        #expect(AssistantRouter.route("   ") == .unknown)
    }

    @Test func itIgnoresCase() {
        #expect(AssistantRouter.route("TRIM THE SILENCES") == .trimSilences)
        #expect(AssistantRouter.route("Transcribe This") == .transcribe)
    }

    @Test func aSentenceAboutSoundAsksForSound() {
        #expect(AssistantRouter.route("add a pop there") == .addSounds)
        #expect(AssistantRouter.route("camera shutter when it lands") == .addSounds)
        #expect(AssistantRouter.route("throw a whoosh on every cut") == .addSounds)
        #expect(AssistantRouter.route("give me some sfx") == .addSounds)
    }

    /// "A pop when the icons show" is an overlay sentence that happens to name a
    /// sound. The overlay is the part that has to land in the right place, and
    /// the same pass carries the sound along with it either way.
    @Test func aSentenceAboutBothIsAnOverlaySentence() {
        #expect(
            AssistantRouter.route("show the icons and add a pop for both") == .placeOverlays
        )
        #expect(
            AssistantRouter.route("put a shutter sound on the overlay") == .placeOverlays
        )
    }

    @Test func aSentenceAboutWordsOnScreenAsksForText() {
        #expect(
            AssistantRouter.route("add a 44% text when i say 44% of users") == .placeText
        )
        #expect(AssistantRouter.route("label each number as I say it") == .placeText)
        #expect(
            AssistantRouter.route("put the percentages on screen as text and hold them")
                == .placeText
        )
    }

    /// "Caption" belongs to the caption track, which has its own button and its
    /// own pass. A sentence about text must not quietly regenerate it.
    @Test func aSentenceAboutCaptionsIsStillAboutCaptions() {
        #expect(AssistantRouter.route("add captions") == .generateCaptions)
        #expect(AssistantRouter.route("caption this video") == .generateCaptions)
    }

    /// Whole words, like the effect matcher: a texture is not a text.
    @Test func aWordThatMerelyContainsTextIsNotText() {
        #expect(AssistantRouter.route("make the textures pop") == .addSounds)
        #expect(AssistantRouter.route("the context here is wrong") == .unknown)
    }

    /// A sentence about how loud something is reaches the pass that sets levels,
    /// including the one about the video, which names no sound at all and used
    /// to fall through to nothing.
    @Test func aSentenceAboutLevelsAsksForLevels() {
        #expect(
            AssistantRouter.route("make all pop sound effects have 80% volume") == .setLevels
        )
        #expect(AssistantRouter.route("set the video volume to 70%") == .setLevels)
        #expect(
            AssistantRouter.route("make all sound effects we have 50% volume") == .setLevels
        )
    }

    /// Adding a sound is not setting its level, whatever else the two share.
    @Test func aSentenceAboutAddingSoundIsStillAboutAddingSound() {
        #expect(AssistantRouter.route("add a pop there") == .addSounds)
        #expect(AssistantRouter.route("throw a whoosh on every cut") == .addSounds)
        #expect(AssistantRouter.route("give me some sfx") == .addSounds)
    }

    /// Half the effect words are short enough to live inside an ordinary one.
    @Test func aWordThatMerelyContainsAnEffectIsNotOne() {
        #expect(AssistantRouter.route("make it more popular") == .unknown)
        #expect(AssistantRouter.route("dinged the whole thing") == .unknown)
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
