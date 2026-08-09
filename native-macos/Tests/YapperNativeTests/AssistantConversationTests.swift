import Foundation
import Testing
@testable import YapperNative

@MainActor
struct AssistantConversationTests {
    @Test func askingStartsTheWaitAndAnsweringEndsIt() {
        let conversation = AssistantConversation()
        #expect(conversation.isEmpty)

        conversation.ask("trim the silences")
        #expect(conversation.isThinking)
        #expect(!conversation.isEmpty)
        #expect(conversation.messages.last?.author == .you)

        conversation.answer(.chirpy("Trimmed the silent gaps."))
        #expect(!conversation.isThinking)
        #expect(conversation.messages.count == 2)
        #expect(conversation.messages.last?.author == .chirpy)
    }

    @Test func onlyTheLastFewExchangesAreKept() {
        let conversation = AssistantConversation()
        for index in 0..<20 {
            conversation.ask("ask \(index)")
            conversation.answer(.chirpy("answer \(index)"))
        }
        #expect(conversation.messages.count == AssistantConversation.limit)
        // The newest survives and the oldest is gone, not the other way round.
        #expect(conversation.messages.last?.text == "answer 19")
        #expect(!conversation.messages.contains { $0.text == "ask 0" })
    }

    @Test func aRunThatIsAbandonedStopsTheDotsRatherThanSpinningForever() {
        let conversation = AssistantConversation()
        conversation.ask("do a thing")
        conversation.giveUp()
        #expect(!conversation.isThinking)
        #expect(conversation.messages.count == 1)
    }

    @Test func clearingLeavesNothingBehind() {
        let conversation = AssistantConversation()
        conversation.ask("hello")
        conversation.clear()
        #expect(conversation.isEmpty)
        #expect(!conversation.isThinking)
    }
}

struct AssistantReplyTests {
    @Test func aPlacementListsWhatItChanged() {
        let reply = AssistantReply.toPlacement(
            .placed(notes: ["cha-ching · 0:12", "01-hook.png · 0:03"])
        )
        #expect(reply.author == .chirpy)
        #expect(reply.tone == .done)
        #expect(reply.text == "Done, 2 changes:")
        #expect(reply.notes.count == 2)
    }

    @Test func oneChangeIsSaidInTheSingular() {
        let reply = AssistantReply.toPlacement(.placed(notes: ["pop · 0:04"]))
        #expect(reply.text == "Done, one change:")
    }

    @Test func aFailureIsRepeatedInChirpysOwnWordsAndMarkedAsTrouble() {
        let reply = AssistantReply.toPlacement(
            .failed("There is no “kazoo” in the sound library.")
        )
        #expect(reply.tone == .trouble)
        #expect(reply.text == "There is no “kazoo” in the sound library.")
        #expect(reply.notes.isEmpty)
    }

    @Test func aPassThatNeverSettledIsNotReportedAsASuccess() {
        #expect(AssistantReply.toPlacement(.working).tone == .trouble)
        #expect(AssistantReply.toPlacement(.idle).tone == .trouble)
    }

    @Test func aCommandAnswersInThePastTense() {
        let reply = AssistantReply.toCommand(.trimSilences, failure: nil)
        #expect(reply.text == "Trimmed the silent gaps.")
        #expect(reply.tone == .done)
    }

    @Test func aCommandThatRaisedIsReportedAsTheFailureAndNotAsDone() {
        let reply = AssistantReply.toCommand(.transcribe, failure: "No audio track.")
        #expect(reply.text == "No audio track.")
        #expect(reply.tone == .trouble)
    }

    @Test func aSentenceChirpyCannotPlaceSaysWhatHeCanDo() {
        let reply = AssistantReply.toCommand(.unknown, failure: nil)
        #expect(reply.tone == .trouble)
        #expect(reply.text.contains("trim silences"))
    }

    @Test func everyIntentHasSomethingToSayWhenItLands() {
        let intents: [AssistantIntent] = [
            .transcribe, .oneClickEdit, .trimSilences, .generateCaptions,
            .hideCaptions, .showCaptions, .addHook, .placeOverlays,
            .addSounds, .unknown,
        ]
        for intent in intents {
            #expect(!intent.settled.isEmpty, "\(intent) has no settled wording")
        }
    }
}
