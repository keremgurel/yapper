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

    /// Where something that began at `start` should finish.
    ///
    /// "Until I say X" ends where X begins: the overlay is gone by the time the
    /// words are heard. "While I say X" starts on X and so is already inside
    /// it; that one ends where X ends. Said more than once and with no
    /// occurrence named, X is the first time it comes after the start.
    static func resolveEnd(
        _ input: TimelineAnchorInput,
        after start: Double,
        project: EditorProject,
        playhead: Double
    ) throws -> Double {
        guard input.kind == .phrase else {
            return try resolve(input, project: project, playhead: playhead, edge: .end)
        }
        let offset = input.offset ?? 0
        let matches = TimelinePhrase.matches(input.phrase ?? "", in: project)
        // Not found at all: the ordinary resolution says why (no transcript,
        // not in the kept speech) and throws.
        if matches.isEmpty { return try resolve(input, project: project, playhead: playhead, edge: .end) }
        let candidates: [TimelinePhrase.Match]
        if let occurrence = input.occurrence {
            guard matches.indices.contains(occurrence - 1) else { throw AppActionError("That occurrence is not in the kept speech.") }
            candidates = [matches[occurrence - 1]]
        } else {
            candidates = matches
        }
        // A beat of slack, so an overlay that comes on just before its own
        // phrase still counts as covering it.
        let slack = 0.25
        if let covering = candidates.first(where: { $0.start + offset <= start + slack && $0.end + offset > start }) {
            return covering.end + offset
        }
        if let next = candidates.first(where: { $0.start + offset > start }) { return next.start + offset }
        throw AppActionError("“\(input.phrase ?? "")” is not said after the overlay starts. Choose a later end.")
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
