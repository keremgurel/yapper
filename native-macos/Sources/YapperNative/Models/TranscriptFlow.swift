import Foundation

/// A silence between two words, shown in the transcript as a `[…]` you can
/// click to cut or restore.
struct TranscriptPause: Identifiable, Equatable, Sendable {
    let mediaID: UUID
    let start: Double
    let end: Double

    /// What the pill reads, shared by the drawing and the measuring.
    var label: String {
        "[…\(duration.formatted(.number.precision(.fractionLength(1))))s]"
    }

    var id: String { "pause-\(mediaID)-\(start)-\(end)" }
    var duration: Double { max(0, end - start) }
}

/// One thing in the transcript's reading order: a word, or the gap after it.
enum TranscriptFlowToken: Identifiable, Equatable, Sendable {
    case word(TranscriptWord)
    case pause(TranscriptPause)

    var id: String {
        switch self {
        case let .word(word): "word-\(word.id)"
        case let .pause(pause): pause.id
        }
    }
}

/// Turns the transcript into the sequence the panel reads out: every word in
/// order, with the noticeable silences between them called out.
///
/// This used to be a computed property on the transcript view, which meant it
/// sorted every word again on each body — including bodies triggered by things
/// with nothing to do with the transcript, like typing in a caption.
enum TranscriptFlow {
    /// Gap between tokens on a line, and between lines.
    static let tokenSpacing = 6.0
    static let lineSpacing = 6.0
    /// Every row is the height of a word cell: 14pt type plus its padding.
    static let lineHeight = 26.0
    /// Wrapping is worked out from measured text, so a hair of margin keeps a
    /// rounding difference from pushing the last token off the end of a line.
    static let wrapMargin = 3.0

    /// How wide a token draws. Words are measured bold, the widest they ever
    /// get, so the playhead moving through them never reflows the paragraph.
    @MainActor
    static func width(of token: TranscriptFlowToken) -> Double {
        switch token {
        case let .word(word):
            TranscriptTokenWidths.width(
                of: word.text,
                font: .systemFont(ofSize: 14, weight: .bold),
                padding: 6
            )
        case let .pause(pause):
            TranscriptTokenWidths.width(
                of: pause.label,
                font: .monospacedSystemFont(ofSize: 10, weight: .bold),
                padding: 10
            )
        }
    }

    /// Shorter gaps than this are just the rhythm of speech, not a pause worth
    /// offering to cut.
    static let minimumPause = 0.4

    static func tokens(words: [TranscriptWord], media: [ProjectMedia]) -> [TranscriptFlowToken] {
        var tokens: [TranscriptFlowToken] = []
        var visitedMediaIDs: Set<UUID> = []
        let mediaOrder = media.map(\.id) + words.map(\.mediaID)

        for mediaID in mediaOrder where visitedMediaIDs.insert(mediaID).inserted {
            let mediaWords = words
                .filter { $0.mediaID == mediaID }
                .sorted { $0.start < $1.start }
            guard let firstWord = mediaWords.first, let lastWord = mediaWords.last else { continue }

            if firstWord.start >= minimumPause {
                tokens.append(.pause(TranscriptPause(mediaID: mediaID, start: 0, end: firstWord.start)))
            }
            for (index, word) in mediaWords.enumerated() {
                tokens.append(.word(word))
                guard index + 1 < mediaWords.count else { continue }
                let nextWord = mediaWords[index + 1]
                if nextWord.start - word.end >= minimumPause {
                    tokens.append(
                        .pause(TranscriptPause(mediaID: mediaID, start: word.end, end: nextWord.start))
                    )
                }
            }
            if let duration = media.first(where: { $0.id == mediaID })?.duration,
               duration - lastWord.end >= minimumPause
            {
                tokens.append(
                    .pause(TranscriptPause(mediaID: mediaID, start: lastWord.end, end: duration))
                )
            }
        }
        return tokens
    }
}
