import Foundation

/// Chirpy reads the current state and feature-owned action catalog. Studio
/// requests retain the authenticated web bridge while its actions migrate.
extension EditorSession {
    func runAssistant(instruction: String) async {
        guard !assistantRunInFlight else { return }
        assistantRunInFlight = true
        defer { assistantRunInFlight = false }
        let text = instruction.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, text.count <= 4000 else { return }

        if assistantUsesStudioBrain || AssistantRouter.requestsBrandKit(text) {
            // Each Studio tab has its own thread; the editor keeps the project's.
            let threads = StudioChirpyThreads.shared
            let thread = assistantUsesStudioBrain ? (threads.current ?? conversation) : conversation
            let history = thread.recentHistory()
            thread.ask(text)
            if assistantUsesStudioBrain, let canvas = IdeaCanvasFocus.shared.runner {
                await canvas.run(text)
                if let failure = canvas.error {
                    thread.answer(.chirpy(failure.message, tone: .trouble))
                } else {
                    thread.answer(.chirpy(canvas.lastReply ?? "Done.", tone: .done))
                }
                return
            }
            do {
                let reply = try await StudioWebCommands.shared.askChirpy(
                    text,
                    surface: assistantUsesStudioBrain ? threads.surface : "/studio/editor",
                    history: history
                )
                thread.answer(
                    .chirpy(
                        reply.text,
                        notes: reply.notes,
                        tone: reply.isTrouble ? .trouble : .done
                    )
                )
            } catch {
                thread.answer(
                    .chirpy(
                        "I couldn’t confirm that Studio change. Check your saved work, then try again.",
                        tone: .trouble
                    )
                )
            }
            return
        }

        let task = Task { @MainActor in await self.runContextualAssistant(text) }
        assistantTask = task
        defer { assistantTask = nil }
        await withTaskCancellationHandler { await task.value } onCancel: { task.cancel() }
    }

}
