import Foundation

/// Holds the transcript's reading order between the changes that affect it.
///
/// The words and their pauses only move when the transcript itself changes or
/// when a cut adds or removes footage. Everything else the editor does — typing
/// in a caption, nudging an overlay, playing the timeline — leaves the list
/// exactly as it was, so it is worth keeping rather than sorting again.
@MainActor
final class TranscriptFlowCache {
    private struct Signature: Equatable {
        let transcript: [TranscriptWord]?
        let clips: [TimelineClip]
        let media: [ProjectMedia]

        init(_ project: EditorProject) {
            transcript = project.transcript
            clips = project.clips
            media = project.media
        }
    }

    private(set) var tokens: [TranscriptFlowToken] = []
    private(set) var words: [TranscriptWord] = []
    /// How wide each token draws. Measured once per transcript, not once per
    /// body: the panel re-renders for all sorts of reasons that have nothing to
    /// do with the words, and a drag elsewhere in the editor was paying for a
    /// full pass over every token on every frame.
    private(set) var tokenWidths: [Double] = []
    /// Which words survived the edit, worked out once per change instead of
    /// once per word view. Answering it per word walked every clip on the
    /// timeline, and the transcript builds hundreds of word views a scroll.
    private(set) var keptWordIDs: Set<UUID> = []
    private var signature: Signature?
    private var wordTokenIndexByID: [UUID: Int] = [:]
    private var timelineWordTargets: [(time: Double, id: UUID)] = []
    private var wrapped: (width: Double, lines: [TranscriptLine], lineByToken: [Int: Int])?

    func refresh(for project: EditorProject) {
        let updated = Signature(project)
        guard updated != signature else { return }
        signature = updated
        words = project.timelineTranscript
        tokens = TranscriptFlow.tokens(words: words, media: project.media)
        tokenWidths = tokens.map(TranscriptFlow.width(of:))
        wordTokenIndexByID = tokens.enumerated().reduce(into: [:]) { result, pair in
            guard case let .word(word) = pair.element else { return }
            result[word.id] = pair.offset
        }
        timelineWordTargets = words.compactMap { word in
            project.timelineTime(for: word).map { (time: $0, id: word.id) }
        }
        .sorted { $0.time < $1.time }
        keptWordIDs = Set(
            project.transcript?.lazy.filter(project.isWordKept).map(\.id) ?? []
        )
        wrapped = nil
    }

    /// Widths are wrapped in steps of this many points.
    ///
    /// Dragging the panel divider asks for a new width for every mouse event,
    /// and each one re-wraps every token in the transcript. Rounding down to a
    /// step means a drag re-wraps a handful of times instead of a hundred, and
    /// costs at most this much of the pane's width, which nobody can see while
    /// it is moving.
    private static let widthStep = 8.0

    /// The wrapping for a given width, worked out once and kept until either
    /// the transcript or the width changes.
    func lines(forWidth width: Double) -> [TranscriptLine] {
        let stepped = (width / Self.widthStep).rounded(.down) * Self.widthStep
        if let wrapped, wrapped.width == stepped { return wrapped.lines }
        let lines = TranscriptLineBreaker.lines(
            widths: tokenWidths,
            spacing: TranscriptFlow.tokenSpacing,
            available: max(1, stepped - TranscriptFlow.wrapMargin)
        )
        var lineByToken: [Int: Int] = [:]
        lineByToken.reserveCapacity(tokens.count)
        for line in lines {
            for token in line.tokens { lineByToken[token] = line.id }
        }
        wrapped = (stepped, lines, lineByToken)
        return lines
    }

    /// The nearest kept word to a completed timeline seek. Binary search keeps
    /// the one-shot lookup independent of transcript length.
    func nearestWordID(to timelineTime: Double) -> UUID? {
        guard !timelineWordTargets.isEmpty else { return nil }
        var low = 0
        var high = timelineWordTargets.count
        while low < high {
            let middle = (low + high) / 2
            if timelineWordTargets[middle].time <= timelineTime {
                low = middle + 1
            } else {
                high = middle
            }
        }
        let previous = low > 0 ? timelineWordTargets[low - 1] : nil
        let next = low < timelineWordTargets.count ? timelineWordTargets[low] : nil
        switch (previous, next) {
        case let (previous?, next?):
            return timelineTime - previous.time <= next.time - timelineTime ? previous.id : next.id
        case let (previous?, nil): return previous.id
        case let (nil, next?): return next.id
        default: return nil
        }
    }

    /// Which lazy transcript row contains a word at the current wrap width.
    func lineID(forWordID id: UUID, width: Double) -> Int? {
        guard let token = wordTokenIndexByID[id] else { return nil }
        _ = lines(forWidth: width)
        return wrapped?.lineByToken[token]
    }
}
