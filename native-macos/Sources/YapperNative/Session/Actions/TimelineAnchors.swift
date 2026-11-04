import CoreGraphics
import Foundation

struct TimelineCueWord: Codable, Sendable {
    let text: String
    let time: Double
    let end: Double
}

enum TimelineCue {
    static func words(in project: EditorProject) -> [TimelineCueWord] {
        var start = 0.0
        var result: [TimelineCueWord] = []
        let byMedia = Dictionary(grouping: project.transcript ?? [], by: \.mediaID)
        for clip in project.clips {
            defer { start += clip.duration }
            for word in (byMedia[clip.mediaID] ?? []).sorted(by: { $0.start < $1.start })
                where word.midpoint >= clip.sourceStart && word.midpoint < clip.sourceEnd {
                result.append(.init(text: word.text,
                    time: start + clip.timelineOffset(forSource: max(clip.sourceStart, word.start)),
                    end: start + clip.timelineOffset(forSource: min(clip.sourceEnd, word.end))))
            }
        }
        return result
    }

    static func tokens(_ text: String) -> [String] {
        text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }
    }

    /// Which end of a cue to land on. Only a phrase has two: everything else
    /// is a moment.
    enum Edge {
        /// Where the cue begins: the first word of a phrase.
        case start
        /// Where the cue finishes: the end of the last word of a phrase.
        case end
    }

    static func resolve(
        _ input: TimelineAnchorInput,
        project: EditorProject,
        playhead: Double,
        edge: Edge = .start
    ) throws -> Double {
        func base() throws -> Double {
            switch input.kind {
            case .event: throw AppActionError("Read the saved animation event before resolving its time.")
            case .playhead: return playhead
            case .time:
                guard let time = input.time else { throw AppActionError("Choose a timeline time for the edit.") }
                return time
            case .speechStart:
                guard let first = words(in: project).first else {
                    throw AppActionError("Transcribe the video first so the edit can follow the start of your speech.")
                }
                return first.time
            case .phrase:
                let match = try phrase(input, in: project)
                return edge == .end ? match.end : match.start
            }
        }
        return try base() + (input.offset ?? 0)
    }

    /// Where something that began at `start` should finish: "until I say X".
    ///
    /// A phrase lands on the end of its last word. Said more than once and
    /// with no occurrence named, it is the first time it finishes after the
    /// start, which is what "until I say it" means; asking which occurrence
    /// would only make the creator count.
    static func resolveEnd(
        _ input: TimelineAnchorInput,
        after start: Double,
        project: EditorProject,
        playhead: Double
    ) throws -> Double {
        guard input.kind == .phrase, input.occurrence == nil else {
            return try resolve(input, project: project, playhead: playhead, edge: .end)
        }
        let offset = input.offset ?? 0
        let matches = TimelinePhrase.matches(input.phrase ?? "", in: project)
        if let next = matches.first(where: { $0.end + offset > start }) { return next.end + offset }
        // Not found at all: the ordinary resolution says why (no transcript,
        // not in the kept speech) and throws.
        if matches.isEmpty { return try resolve(input, project: project, playhead: playhead, edge: .end) }
        throw AppActionError("“\(input.phrase ?? "")” finishes before the overlay starts. Choose a later end.")
    }

    private static func phrase(_ input: TimelineAnchorInput, in project: EditorProject) throws -> TimelinePhrase.Match {
        guard !tokens(input.phrase ?? "").isEmpty else { throw AppActionError("Tell me the spoken phrase to use.") }
        guard !words(in: project).isEmpty else { throw AppActionError("Transcribe the video first so I can find that phrase.") }
        let matches = TimelinePhrase.matches(input.phrase ?? "", in: project)
        guard !matches.isEmpty else {
            throw AppActionError("I couldn’t find “\(input.phrase ?? "")” in the kept speech. Check the transcript or choose the playhead.")
        }
        if matches.count > 1 && input.occurrence == nil {
            let times = matches.prefix(6).map { String(format: "%.2fs", $0.start) }.joined(separator: ", ")
            throw AppActionError("That phrase occurs \(matches.count) times (\(times)). Say which occurrence to use.")
        }
        let index = (input.occurrence ?? 1) - 1
        guard matches.indices.contains(index) else { throw AppActionError("That occurrence is not in the kept speech.") }
        return matches[index]
    }
}
