import Foundation

/// One line of the conversation with Chirpy.
///
/// A message is the whole of a turn: what was asked, or what came back. Nothing
/// carries between them — each sentence is answered on its own — so these are a
/// record of what happened rather than context for what happens next.
struct AssistantMessage: Identifiable, Equatable, Sendable {
    enum Author: Equatable, Sendable {
        case you
        case chirpy
    }

    /// How the reply landed, which is the difference between a tick and a
    /// warning and, more usefully, between reading it and skimming past it.
    enum Tone: Equatable, Sendable {
        case asked
        case done
        case trouble
    }

    let id: UUID
    let author: Author
    let text: String
    /// One line per change that landed, listed under the reply. Empty on
    /// anything that changed nothing.
    let notes: [String]
    let tone: Tone

    init(
        id: UUID = UUID(),
        author: Author,
        text: String,
        notes: [String] = [],
        tone: Tone
    ) {
        self.id = id
        self.author = author
        self.text = text
        self.notes = notes
        self.tone = tone
    }

    static func you(_ text: String) -> AssistantMessage {
        AssistantMessage(author: .you, text: text, tone: .asked)
    }

    static func chirpy(
        _ text: String,
        notes: [String] = [],
        tone: Tone = .done
    ) -> AssistantMessage {
        AssistantMessage(author: .chirpy, text: text, notes: notes, tone: tone)
    }
}
