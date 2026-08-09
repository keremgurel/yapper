import Foundation

/// One thing the model asked for: this media, over these words, about here on
/// the frame.
struct OverlayPlacement: Equatable, Sendable {
    /// The media's file name, as it appears in the library.
    let file: String
    /// Words copied from the transcript, marking where the overlay belongs.
    let quote: String
    /// Why, in one short line. Shown to the creator, never acted on.
    let reason: String?
    /// Where on the frame it asked for the overlay, or nil when it did not say.
    /// A proposal, not an instruction: `OverlayLayout` repairs it against the
    /// faces actually found in the footage before anything is placed.
    let box: ProposedOverlayBox?
    /// The word inside the quote the overlay should appear on. Without one the
    /// overlay covers the quote, which is how placements worked before cues.
    let cue: String?
    /// A label shared by media that belongs in one row. Members are laid out
    /// together by `OverlayRowLayout` and leave the screen together.
    let group: String?
    /// An effect from the shipped library to play as it appears.
    let sound: String?

    init(
        file: String,
        quote: String,
        reason: String?,
        box: ProposedOverlayBox? = nil,
        cue: String? = nil,
        group: String? = nil,
        sound: String? = nil
    ) {
        self.file = file
        self.quote = quote
        self.reason = reason
        self.box = box
        self.cue = cue
        self.group = group
        self.sound = sound
    }
}

/// A placement that has been found in the transcript, as a run of words.
struct PlacedOverlaySpan: Equatable, Sendable {
    let file: String
    let reason: String?
    /// Index of the first word the overlay covers, into the same array the
    /// span was found in.
    let firstWord: Int
    /// Index of the last word it covers, inclusive.
    let lastWord: Int
    /// The word the overlay comes on screen for. The quote's first word unless
    /// a cue named another one inside it.
    let anchorWord: Int
    let box: ProposedOverlayBox?
    let group: String?
    let sound: String?

    init(
        file: String,
        reason: String?,
        firstWord: Int,
        lastWord: Int,
        anchorWord: Int? = nil,
        box: ProposedOverlayBox? = nil,
        group: String? = nil,
        sound: String? = nil
    ) {
        self.file = file
        self.reason = reason
        self.firstWord = firstWord
        self.lastWord = lastWord
        self.anchorWord = anchorWord ?? firstWord
        self.box = box
        self.group = group
        self.sound = sound
    }
}

/// Turning a model's reply into overlays the transcript can back.
///
/// The model is only ever asked for quotes. Seconds and word indices are things
/// a language model cannot count, and an off-by-one there lands a cutaway over
/// the wrong sentence. Quotes are matched back against the transcript here, and
/// anything it invented is dropped before the timeline hears about it.
enum OverlayPlan {
    /// The shortest overlay worth placing. A quote of one short word is not a shot.
    static let minimumSpanSeconds = 0.4

    /// Pull the placements out of a reply, which may be fenced, chatty, or
    /// nonsense. Anything that isn't a file name and a quote is dropped here
    /// rather than trusted downstream.
    static func parsePlacements(_ reply: String) -> [OverlayPlacement] {
        guard
            let start = reply.firstIndex(of: "{"),
            let end = reply.lastIndex(of: "}"),
            start < end,
            let data = String(reply[start ... end]).data(using: .utf8),
            let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let raw = root["placements"] as? [Any]
        else { return [] }

        return raw.compactMap { entry in
            guard
                let entry = entry as? [String: Any],
                let file = entry["file"] as? String,
                let quote = entry["quote"] as? String
            else { return nil }
            return OverlayPlacement(
                file: file,
                quote: quote,
                reason: entry["reason"] as? String,
                box: proposedBox(entry),
                cue: entry["cue"] as? String,
                group: entry["group"] as? String,
                sound: entry["sound"] as? String
            )
        }
    }

    /// The furthest outside the frame a proposal may reach before it stops
    /// being a box that slipped and starts being a number that means nothing.
    private static let proposalBound = -0.5 ... 1.5

    /// The box in a placement, or nil when the model left it out or answered
    /// with something that is not a fraction of a frame.
    ///
    /// Height is never read. It is derived from the width and the media's own
    /// shape, so a wrong guess here cannot squash a picture, and a placement
    /// whose box is nonsense still lands on the right words.
    static func proposedBox(x: Double?, y: Double?, width: Double?) -> ProposedOverlayBox? {
        func usable(_ value: Double?) -> Double? {
            guard let value, value.isFinite, proposalBound.contains(value) else { return nil }
            return value
        }
        guard
            let width = usable(width), width > 0,
            let x = usable(x),
            let y = usable(y)
        else { return nil }
        return ProposedOverlayBox(x: x, y: y, width: width)
    }

    static func proposedBox(_ entry: [String: Any]) -> ProposedOverlayBox? {
        proposedBox(
            x: (entry["x"] as? NSNumber)?.doubleValue,
            y: (entry["y"] as? NSNumber)?.doubleValue,
            width: (entry["width"] as? NSNumber)?.doubleValue
        )
    }

    /// Where a quoted phrase sits in the transcript, as an inclusive range of
    /// word indices, or nil when it isn't really there.
    ///
    /// The model is asked to copy the speaker's words verbatim, and mostly
    /// does, but it drops a filler word or fixes a contraction often enough
    /// that exact matching alone would throw away good placements. So: an exact
    /// run of tokens first, then the best window of the same length, accepted
    /// only if most of its tokens agree.
    static func quoteSpan(in words: [TranscriptWord], quote: String) -> ClosedRange<Int>? {
        // Punctuation-only words cannot be matched against, but they can be
        // spanned, so they keep their place in the transcript's own indices.
        let source: [(token: String, index: Int)] = words.enumerated().compactMap { index, word in
            let token = normalized(word.text)
            return token.isEmpty ? nil : (token, index)
        }
        let wanted = quote
            .split(whereSeparator: \.isWhitespace)
            .map { normalized(String($0)) }
            .filter { !$0.isEmpty }

        guard !wanted.isEmpty, source.count >= wanted.count else { return nil }

        func span(at offset: Int) -> ClosedRange<Int> {
            source[offset].index ... source[offset + wanted.count - 1].index
        }

        var best: (offset: Int, hits: Int)?
        for offset in 0 ... (source.count - wanted.count) {
            var hits = 0
            for step in wanted.indices where source[offset + step].token == wanted[step] {
                hits += 1
            }
            if hits == wanted.count { return span(at: offset) }
            if best == nil || hits > best!.hits { best = (offset, hits) }
        }
        guard let best, Double(best.hits) >= (Double(wanted.count) * 0.6).rounded(.up) else {
            return nil
        }
        return span(at: best.offset)
    }

    /// Turn the model's placements into runs of transcript words, dropping
    /// every one it made up: an unknown file, a quote that isn't in the
    /// transcript, a span too short to see, or one that jumps between two
    /// recordings. Nothing the transcript does not back reaches the timeline.
    ///
    /// Two unrelated placements still may not claim the same stretch of speech:
    /// that is a model losing track of itself, and two pictures over one
    /// sentence for no reason is worse than one.
    ///
    /// A row is the exception it is there for, and it is a total one. Members of
    /// one group may share a quote, and may share a word: "show all three icons
    /// when I say socials" is three overlays on one syllable, and the row lays
    /// them out side by side rather than on top of each other. Nothing about
    /// being simultaneous is a problem once something is deciding where they go.
    static func spans(
        words: [TranscriptWord],
        placements: [OverlayPlacement],
        knownFiles: [String]
    ) -> [PlacedOverlaySpan] {
        let known = Set(knownFiles)
        var taken: [(span: ClosedRange<Int>, group: String?)] = []
        var result: [PlacedOverlaySpan] = []

        for placement in placements {
            guard
                known.contains(placement.file),
                let span = quoteSpan(in: words, quote: placement.quote),
                words.indices.contains(span.lowerBound),
                words.indices.contains(span.upperBound)
            else { continue }
            let first = words[span.lowerBound]
            let last = words[span.upperBound]
            guard
                first.mediaID == last.mediaID,
                last.end - first.start >= minimumSpanSeconds
            else { continue }

            // A cue that isn't in the sentence is not worth losing the
            // placement over: the quote already found the right moment, and the
            // start of it is where an overlay went before cues existed.
            let anchor = placement.cue
                .flatMap { OverlayCue.anchor(in: words, span: span, cue: $0) }
                ?? span.lowerBound
            let clashes = taken.contains { other in
                // A row may put as many things on one moment as it likes. It is
                // the one thing here that knows how to lay them out.
                let sameRow = placement.group != nil && other.group == placement.group
                return sameRow ? false : other.span.overlaps(span)
            }
            guard !clashes else { continue }

            taken.append((span, placement.group))
            result.append(
                PlacedOverlaySpan(
                    file: placement.file,
                    reason: placement.reason,
                    firstWord: span.lowerBound,
                    lastWord: span.upperBound,
                    anchorWord: anchor,
                    box: placement.box,
                    group: placement.group,
                    sound: placement.sound
                )
            )
        }
        return result
    }

    /// Which of the library's files an instruction actually mentions, in the
    /// library's own order. Matched longest name first, so `@intro.mp4` inside
    /// the text of `@intro.mp4.bak` never wins.
    static func mentionedNames(in text: String, names: [String]) -> [String] {
        var remaining = text.lowercased()
        var found: Set<String> = []
        for name in names.sorted(by: { $0.count > $1.count }) {
            let needle = "@" + name.lowercased()
            guard remaining.contains(needle) else { continue }
            found.insert(name)
            remaining = remaining.replacingOccurrences(of: needle, with: " ")
        }
        return names.filter { found.contains($0) }
    }

    /// One transcript word, stripped to what can be compared. Shared with
    /// `OverlayCue`, which has to tokenise the same way or a cue would miss a
    /// word its own quote had already matched.
    static func normalized(_ text: String) -> String {
        text.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" }
    }
}
