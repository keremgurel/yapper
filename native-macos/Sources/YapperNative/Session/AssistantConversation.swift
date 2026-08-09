import Foundation

/// What you and Chirpy have said to each other lately.
///
/// Deliberately shallow. Nothing here is sent back to the model: every
/// instruction is routed and answered on its own, so this is a receipt of what
/// happened rather than a context window. That is also why it can be thrown
/// away at the oldest end without anything breaking.
@MainActor
final class AssistantConversation: ObservableObject {
    /// Five exchanges. Enough to see that the last few things you asked for
    /// actually happened, short enough that the panel never becomes a place you
    /// scroll rather than read.
    static let limit = 10

    @Published private(set) var messages: [AssistantMessage] = []
    /// True between the question and the answer, which is what the typing dots
    /// are drawn from.
    @Published private(set) var isThinking = false

    var isEmpty: Bool { messages.isEmpty && !isThinking }

    func ask(_ text: String) {
        append(.you(text))
        isThinking = true
    }

    func answer(_ message: AssistantMessage) {
        isThinking = false
        append(message)
    }

    /// Ends the wait without an answer, for a run that was abandoned rather
    /// than finished. Leaving the dots spinning forever would be worse.
    func giveUp() {
        isThinking = false
    }

    func clear() {
        messages = []
        isThinking = false
    }

    private func append(_ message: AssistantMessage) {
        messages.append(message)
        if messages.count > Self.limit {
            messages.removeFirst(messages.count - Self.limit)
        }
    }
}
