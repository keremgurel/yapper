import Foundation

/// What Chirpy says once the work has landed.
///
/// Kept out of the session so the wording is a thing that can be read and
/// tested on its own. Every reply is in the past tense and names what changed:
/// "Trimmed the silent gaps" tells you an edit happened to your video, where
/// "Done" leaves you to go and look.
enum AssistantReply {
    /// The answer to a sentence that went to the overlay pass, which is the one
    /// that reports what it did line by line.
    static func toPlacement(_ status: OverlayPlacementStatus) -> AssistantMessage {
        switch status {
        case let .placed(notes):
            .chirpy(landed(notes.count), notes: notes)
        case let .failed(message):
            .chirpy(message, tone: .trouble)
        case .idle, .working:
            // The pass returned without settling either way, which should not
            // happen and must not be reported as a success if it does.
            .chirpy("That did not finish. Try asking again?", tone: .trouble)
        }
    }

    /// The answer to a sentence that reached one of the editor's own commands.
    static func toCommand(_ intent: AssistantIntent, failure: String?) -> AssistantMessage {
        if let failure { return .chirpy(failure, tone: .trouble) }
        return .chirpy(intent.settled, tone: intent == .unknown ? .trouble : .done)
    }

    private static func landed(_ count: Int) -> String {
        switch count {
        case 0: "Done."
        case 1: "Done, one change:"
        default: "Done, \(count) changes:"
        }
    }
}
