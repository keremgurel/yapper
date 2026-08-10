import Foundation
import Testing
@testable import YapperNative

/// Runs the trimmer over a real recording and reports what it would leave.
///
/// Gated on `TRIM_MEDIA` and `TRIM_PROJECT` because it needs footage that is
/// not in the repository. It exists because the last three attempts at this
/// were checked against synthetic tones and shipped a timeline full of
/// frame-long silent clips: the only honest test is the take the creator is
/// actually looking at.
@Suite(.serialized)
struct RealTakeTrimDiagnostics {
    private struct Project: Decodable {
        struct Word: Decodable {
            let mediaID: UUID
            let text: String
            let start: Double
            let end: Double
        }
        struct Media: Decodable {
            let id: UUID
            let duration: Double
        }
        let transcript: [Word]?
        let media: [Media]
    }

    @Test("What the trimmer leaves on a real take")
    func report() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard
            let mediaPath = environment["TRIM_MEDIA"],
            let projectPath = environment["TRIM_PROJECT"]
        else { return }

        let project = try JSONDecoder().decode(
            Project.self,
            from: Data(contentsOf: URL(fileURLWithPath: projectPath))
        )
        let media = try #require(project.media.first)
        let words = (project.transcript ?? []).map {
            TranscriptWord(mediaID: $0.mediaID, text: $0.text, start: $0.start, end: $0.end)
        }
        let url = URL(fileURLWithPath: mediaPath)

        let ranges = await AIEditService().autoEditRanges(
            words: words,
            duration: media.duration,
            aiCuts: [],
            url: url
        )

        // What survives: the gaps between the removals.
        var kept: [(Double, Double)] = []
        var cursor = 0.0
        for range in ranges.sorted(by: { $0.0 < $1.0 }) {
            if range.0 > cursor { kept.append((cursor, range.0)) }
            cursor = max(cursor, range.1)
        }
        if cursor < media.duration { kept.append((cursor, media.duration)) }

        let envelope = try LoudnessEnvelope.measure(url: url)
        let threshold = SilenceScan.threshold(loudness: envelope.loudness, settings: .init())
        func isAudible(_ segment: (Double, Double)) -> Bool {
            let from = max(0, Int(segment.0 / envelope.hop))
            let to = min(envelope.loudness.count, Int(segment.1 / envelope.hop))
            guard from < to else { return false }
            return envelope.loudness[from ..< to].contains { $0 > threshold }
        }

        let silent = kept.filter { !isAudible($0) }
        let tiny = kept.filter { $0.1 - $0.0 < 0.35 }
        print("""

        === trim report ===
        take            \(String(format: "%.1fs", media.duration))
        words           \(words.count)
        removed         \(ranges.count) ranges, \
        \(String(format: "%.1fs", ranges.reduce(0) { $0 + ($1.1 - $1.0) }))
        clips left      \(kept.count)
        shorter than .35s  \(tiny.count)
        with no sound in them  \(silent.count)
        """)
        for segment in kept where !isAudible(segment) || segment.1 - segment.0 < 0.35 {
            let overlapping = words.filter { $0.end > segment.0 && $0.start < segment.1 }
            print(String(
                format: "  %.2f → %.2f  (%.2fs) audible=%@ words=%@",
                segment.0, segment.1, segment.1 - segment.0,
                isAudible(segment) ? "Y" : "N",
                overlapping.map(\.text).joined(separator: " ")
            ))
        }

        // The other half of the complaint: a word whose audio survives must
        // not be drawn as cut. The transcript decides that by the word's
        // midpoint, so a cut that laps over a word's generous boundary strikes
        // it through while it is still in the video.
        let struckThrough = words.filter { word in
            let midpoint = (word.start + word.end) / 2
            return !kept.contains { midpoint >= $0.0 && midpoint <= $0.1 }
        }
        print("words shown as cut: \(struckThrough.count) of \(words.count)")
        for word in struckThrough.prefix(8) {
            print(String(format: "  %.2f-%.2f %@", word.start, word.end, word.text))
        }

        #expect(silent.isEmpty, "a clip with no sound in it should never survive the trim")
        #expect(tiny.isEmpty, "a clip too short to see should never survive the trim")
        #expect(
            struckThrough.isEmpty,
            "no retakes were requested, so every word should still be in the edit"
        )
    }
}
