import Foundation

/// Asking the editor for something in words.
///
/// The assistant is a way into commands the app already has, not a second
/// implementation of them: every branch below calls exactly the code the button
/// of the same name calls, so a sentence and a click can never drift apart.
extension EditorSession {
    func runAssistant(instruction: String) async {
        guard !assistantRunInFlight else { return }
        assistantRunInFlight = true
        defer { assistantRunInFlight = false }
        let text = instruction.trimmingCharacters(in: .whitespacesAndNewlines)

        if assistantUsesStudioBrain || AssistantRouter.requestsBrandKit(text) {
            conversation.ask(text)
            do {
                let reply = try await StudioWebCommands.shared.askChirpy(text)
                conversation.answer(
                    .chirpy(
                        reply.text,
                        notes: reply.notes,
                        tone: reply.isTrouble ? .trouble : .done
                    )
                )
            } catch {
                conversation.answer(
                    .chirpy(
                        "I couldn’t confirm that Studio change. Check your saved work, then try again.",
                        tone: .trouble
                    )
                )
            }
            return
        }

        let intent = AssistantRouter.route(
            text,
            mentionsFile: !OverlayMention.mentioned(
                in: text,
                names: placeableMedia.map(\.name)
            ).isEmpty
        )

        let requiresLongOperation: Bool = switch intent {
        case .transcribe, .oneClickEdit, .trimSilences, .generateCaptions,
             .hideCaptions, .showCaptions, .placeOverlays, .addSounds,
             .placeText, .setLevels, .addHook, .clipControls:
            true
        default:
            false
        }
        guard !requiresLongOperation || activeOperation == nil else { return }

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

        var canceled = false
        switch intent {
        case .clipControls:
            guard let command = ClipControlCommand.parse(text) else { return }
            let result: AppActionResult
            switch command {
            case let .speed(rate, all):
                result = await performAppAction(ClipSpeedInput(clipIDs: speedTargetIDs(applyToAll: all), rate: rate))
            case let .lock(locked, captions, all):
                let items: Set<TimelineSelectionItem>
                if captions {
                    items = Set((all ? project.storedCaptions.map(\.id) : Array(selectedCaptionIDs)).map { .caption($0) })
                } else {
                    let selected = timelineSelection.compactMap { item -> UUID? in
                        if case let .clip(id) = item { return id }; return nil
                    }
                    let ids = all ? project.clips.map(\.id) : (selected.isEmpty ? [speedClip?.id].compactMap { $0 } : selected)
                    items = Set(ids.map { .clip($0) })
                }
                let clipIDs = items.compactMap { item -> UUID? in
                    if case let .clip(id) = item { return id }; return nil
                }.sorted { $0.uuidString < $1.uuidString }
                let captionIDs = items.compactMap { item -> UUID? in
                    if case let .caption(id) = item { return id }; return nil
                }.sorted { $0.uuidString < $1.uuidString }
                result = await performAppAction(TimelineLockInput(clipIDs: clipIDs, captionIDs: captionIDs, locked: locked))
            }
            conversation.answer(.toAction(result))
            return
        case .transcribe:
            await transcribeProject()
            canceled = lastTranscriptionWasCanceled
        case .oneClickEdit:
            canceled = await runOneClickEdit()
        case .trimSilences:
            canceled = await autoTrimSilences()
        case .generateCaptions:
            canceled = await generateCaptions()
        case .hideCaptions:
            conversation.answer(.toAction(await performAppAction(CaptionVisibilityInput(visible: false))))
            return
        case .showCaptions:
            conversation.answer(.toAction(await performAppAction(CaptionVisibilityInput(visible: true))))
            return
        case .addHook:
            addTextLayer(asHook: true)
        case .placeOverlays, .addSounds, .placeText, .setLevels:
            // One pass whichever it is: the reply carries the media over words,
            // the sounds that belong to no media and the words to draw over the
            // video, so asking for any of them reaches the same place.
            canceled = await placeOverlaysWithAI(instruction: text)
        case .unknown:
            break
        }

        if canceled {
            conversation.answer(
                AssistantReply.toCommand(
                    intent,
                    failure: intent == .transcribe
                        ? "Transcription was canceled."
                        : "The operation was canceled."
                )
            )
            return
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
