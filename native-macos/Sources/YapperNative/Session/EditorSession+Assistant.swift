import Foundation

/// Asking the editor for something in words.
///
/// The assistant is a way into commands the app already has, not a second
/// implementation of them: every branch below calls exactly the code the button
/// of the same name calls, so a sentence and a click can never drift apart.
extension EditorSession {
    func runAssistant(instruction: String) async {
        let text = instruction.trimmingCharacters(in: .whitespacesAndNewlines)
        let intent = AssistantRouter.route(
            text,
            mentionsFile: !OverlayMention.mentioned(
                in: text,
                names: placeableMedia.map(\.name)
            ).isEmpty
        )

        conversation.ask(text)
        guard intent != .unknown else {
            setStatus(intent.spoken)
            conversation.answer(AssistantReply.toCommand(intent, failure: nil))
            return
        }
        setStatus(intent.spoken)

        // Only a failure raised by this run should be reported as this run's,
        // so whatever was already on screen is cleared before it starts.
        clearError()
        let failureBefore = errorMessage

        switch intent {
        case .transcribe:
            await transcribeProject()
        case .oneClickEdit:
            await runOneClickEdit()
        case .trimSilences:
            await autoTrimSilences()
        case .generateCaptions:
            await generateCaptions()
        case .hideCaptions:
            if captionsVisible { await toggleCaptions() }
        case .showCaptions:
            if !captionsVisible { await toggleCaptions() }
        case .addHook:
            addTextLayer(asHook: true)
        case .placeOverlays, .addSounds, .placeText, .setLevels:
            // One pass whichever it is: the reply carries the media over words,
            // the sounds that belong to no media and the words to draw over the
            // video, so asking for any of them reaches the same place.
            await placeOverlaysWithAI(instruction: text)
        case .unknown:
            break
        }

        switch intent {
        case .placeOverlays, .addSounds, .placeText, .setLevels:
            // The overlay pass already says what it did, line by line.
            conversation.answer(AssistantReply.toPlacement(overlayPlacement))
        default:
            conversation.answer(
                AssistantReply.toCommand(
                    intent,
                    failure: errorMessage == failureBefore ? nil : errorMessage
                )
            )
        }
    }

    /// What the assistant will attempt, for the box to show before it is sent.
    /// Saying it up front is what stops a sentence quietly running the wrong
    /// edit on somebody's video.
    func assistantPreview(for instruction: String) -> AssistantIntent {
        AssistantRouter.route(
            instruction.trimmingCharacters(in: .whitespacesAndNewlines),
            mentionsFile: !OverlayMention.mentioned(
                in: instruction,
                names: placeableMedia.map(\.name)
            ).isEmpty
        )
    }
}
