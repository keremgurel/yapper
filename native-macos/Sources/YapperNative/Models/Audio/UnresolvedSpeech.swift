import Foundation

/// A classifier can hear speech where ASR hears only noise. Keep that audio
/// instead of either failing the whole edit or inventing caption words.
enum UnresolvedSpeech {
    static func protecting(
        _ speech: [[Double]],
        from cuts: [(Double, Double)],
        words: [TranscriptWord]
    ) -> [(Double, Double)] {
        let protected = speech.compactMap { range -> (Double, Double)? in
            guard range.count == 2, range.allSatisfy(\.isFinite), range[1] > range[0] else { return nil }
            var start = max(0, range[0] - 0.25)
            var end = range[1] + 0.25
            let window = (start, end)
            // Keep neighbouring words whole rather than leaving an isolated
            // syllable at a new edit boundary.
            for word in words where word.start < window.1 && word.end > window.0 {
                start = min(start, word.start)
                end = max(end, word.end)
            }
            return (start, end)
        }
        // Reject a crossing retake cut as a whole. Splitting it around unknown
        // speech would retain the unknown fragment without its surrounding take.
        return cuts.filter { cut in
            !protected.contains { cut.0 < $0.1 && cut.1 > $0.0 }
        }
    }
}
