import Foundation

/// The transcript as Chirpy reads it: numbered words in the transcript panel's
/// reading order, grouped by recording. A word ID per word made the transcript
/// almost thirty times larger than its text and pushed long projects past the
/// planning request limit, so words travel as numbers and are resolved here.
extension EditorProject {
    /// Every word in reading order. A word's position is its number in
    /// `chirpyTranscript()` and in `editor.transcript.setWordRangesKept`.
    var chirpyNumberedWords: [TranscriptWord] {
        TranscriptFlow.tokens(words: transcript ?? [], media: media).compactMap { token in
            if case let .word(word) = token { return word }
            return nil
        }
    }

    /// One entry per run of a recording. Text reads like
    /// `0:It's 1:been [2:um] (pause 4.120-4.900) 3:one`: brackets mark what is
    /// cut from the edit, and pause times are recording seconds.
    func chirpyTranscript(wordLimit: Int = 4000) -> [ActionJSON] {
        var runs: [(mediaID: UUID, parts: [String])] = []
        var number = 0
        for token in TranscriptFlow.tokens(words: transcript ?? [], media: media) {
            guard number < wordLimit else { break }
            let mediaID: UUID, part: String
            switch token {
            case let .word(word):
                let text = "\(number):\(word.text)"
                (mediaID, part) = (word.mediaID, isWordKept(word) ? text : "[\(text)]")
                number += 1
            case let .pause(pause):
                let text = "pause \(Self.seconds(pause.start))-\(Self.seconds(pause.end))"
                let kept = isSourceRangeKept(mediaID: pause.mediaID, start: pause.start, end: pause.end)
                (mediaID, part) = (pause.mediaID, kept ? "(\(text))" : "[\(text)]")
            }
            if runs.last?.mediaID == mediaID { runs[runs.count - 1].parts.append(part) }
            else { runs.append((mediaID, [part])) }
        }
        return runs.map { .object(["mediaID": .string($0.mediaID.uuidString), "text": .string($0.parts.joined(separator: " "))]) }
    }

    private static func seconds(_ value: Double) -> String { String(format: "%.3f", value) }
}
