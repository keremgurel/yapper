import Foundation
import Testing
@testable import YapperNative

/// Times the caption lookups the editor performs while you drag a card, type in
/// one, or simply play the timeline. Prints rather than asserts: the point is to
/// see the cost of one frame's worth of work on a realistic project.
@Suite(.serialized)
struct CaptionCostBenchmark {
    @Test(
        "Caption lookup cost per frame",
        .enabled(if: ProcessInfo.processInfo.environment["YAPPER_BENCH"] == "1")
    )
    @MainActor func captionLookupCost() {
        let project = Self.realisticProject()
        print("project: \(project.clips.count) clips, \(project.transcript?.count ?? 0) words, \(project.captionEntries.count) cards")

        let cues = measure { _ = project.captionCues }
        let one = measure { _ = project.captionCue(at: 12.5) }
        let texts = measure { _ = project.captionTextsByID }

        print(String(
            format: "raw model: captionCues %.2f ms · captionCue(at:) %.2f ms · captionTextsByID %.2f ms",
            cues * 1000,
            one * 1000,
            texts * 1000
        ))

        // What the editor actually pays now: one build, then free reads. A UI
        // update used to ask the model four or five times over.
        let cache = CaptionCueCache()
        let firstRefresh = measure { cache.refresh(for: project) }
        let fiveReads = measure {
            for _ in 0 ..< 5 {
                _ = cache.cues
                _ = cache.cue(at: 12.5)
            }
        }
        let unchangedRefresh = measure { cache.refresh(for: project) }
        print(String(
            format: "cached: build %.2f ms · 5 reads %.4f ms · refresh with nothing changed %.4f ms",
            firstRefresh * 1000,
            fiveReads * 1000,
            unchangedRefresh * 1000
        ))

        // A keystroke in a card: the text changes, so the list is genuinely
        // rebuilt. This is the floor for typing, and what the timeline and the
        // list panel used to pay several times over on top.
        var typed = project
        if let first = typed.captions?.first?.id {
            typed.setCaptionText("edited text", for: first)
        }
        let keystroke = measure { cache.refresh(for: typed) }

        // One timeline frame: how many of those cards actually get a cell at a
        // normal zoom, where about twelve seconds are on screen.
        let visible = TimelineVisibleRange.make(
            scrollX: 4_000,
            viewportWidth: 1_200,
            contentWidth: 60_000,
            duration: typed.duration
        )
        let drawn = cache.cues.filter {
            visible.showsItem(start: $0.timelineStart, duration: $0.duration)
        }
        print(String(
            format: "keystroke %.2f ms · cells drawn %d of %d (%@)",
            keystroke * 1000,
            drawn.count,
            cache.cues.count,
            "\(Int(visible.lowerBound))s to \(Int(visible.upperBound))s"
        ))

        // The transcript panel rebuilt its reading order on every body, which
        // included every body triggered by something unrelated to it.
        let flow = TranscriptFlowCache()
        let flowBuild = measure { flow.refresh(for: typed) }
        var edited = typed
        if let first = edited.captions?.first?.id {
            edited.setCaptionText("edited again", for: first)
        }
        let flowAfterKeystroke = measure { flow.refresh(for: edited) }
        print(String(
            format: "transcript flow: build %.2f ms (%d tokens) · after a caption keystroke %.4f ms",
            flowBuild * 1000,
            flow.tokens.count,
            flowAfterKeystroke * 1000
        ))

        #expect(!cache.cues.isEmpty)
        #expect(drawn.count < cache.cues.count)
        #expect(!flow.tokens.isEmpty)
    }

    /// Roughly a ten minute talking-head edit: cut into clips, fully
    /// transcribed, captioned end to end.
    static func realisticProject() -> EditorProject {
        let mediaID = UUID()
        let media = ProjectMedia(
            id: mediaID,
            url: URL(filePath: "/tmp/bench.mov"),
            name: "bench",
            duration: 600,
            width: 1_920,
            height: 1_080,
            hasAudio: true
        )
        let clips = (0 ..< 40).map { index in
            TimelineClip(
                mediaID: mediaID,
                sourceStart: Double(index) * 15,
                sourceEnd: Double(index) * 15 + 14
            )
        }
        let words = (0 ..< 2_000).map { index in
            TranscriptWord(
                mediaID: mediaID,
                text: "word\(index)",
                start: Double(index) * 0.3,
                end: Double(index) * 0.3 + 0.25
            )
        }
        var project = EditorProject(
            name: "Caption benchmark",
            media: [media],
            clips: clips,
            transcript: words,
            captionsEnabled: true
        )
        project.regenerateCaptions()
        return project
    }

    private func measure(_ work: () -> Void) -> Double {
        let start = ContinuousClock.now
        work()
        return Double(ContinuousClock.now.duration(to: start).components.attoseconds) / -1e18
    }
}
