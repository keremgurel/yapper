import Foundation
import Testing
@testable import YapperNative

/// Replays saved cleaner decisions through the actual native finishing,
/// source trimming, and caption generation code. No network calls or writes
/// to the creator's open project. Supply an optional output directory to make
/// a separate project for review.
struct OneClickReplayDiagnostics {
    private struct Fixture: Decodable {
        struct Word: Decodable {
            let text: String
            let start: Double
            let end: Double
        }
        let words: [Word]
        let keptSpans: [[Int]]
    }

    @Test("a real cleaner decision survives the complete native pipeline")
    func replay() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard let projectPath = environment["ONE_CLICK_REPLAY_PROJECT"],
              let fixturePath = environment["ONE_CLICK_REPLAY_FIXTURE"]
        else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let original = try decoder.decode(
            EditorProject.self, from: Data(contentsOf: URL(filePath: projectPath))
        )
        let fixture = try decoder.decode(
            Fixture.self, from: Data(contentsOf: URL(filePath: fixturePath))
        )
        let mediaID = try #require(original.clips.first?.mediaID)
        let media = try #require(original.media.first { $0.id == mediaID })
        let words = (original.transcript ?? []).filter { $0.mediaID == mediaID }
        try #require(words.count == fixture.words.count)
        try #require(HeardWords.withoutDoubledEmissions(words).map(\.id) == words.map(\.id),
                     "native duplicate filtering must preserve the recovered transcript")
        try #require(zip(words, fixture.words).allSatisfy {
            $0.text == $1.text && $0.start == $1.start && $0.end == $1.end
        }, "the decisions must reference this exact transcript")
        var expected = Set<Int>()
        for span in fixture.keptSpans {
            try #require(span.count == 2 && span[0] <= span[1])
            try #require(words.indices.contains(span[0]) && words.indices.contains(span[1]))
            expected.formUnion(span[0] ... span[1])
        }
        var cuts: [(Int, Int)] = []
        var start: Int?
        for index in words.indices {
            if !expected.contains(index), start == nil { start = index }
            if expected.contains(index), let lower = start {
                cuts.append((lower, index - 1))
                start = nil
            }
        }
        if let start { cuts.append((start, words.count - 1)) }

        let finished = EditFinishing.aiCuts(cuts, words: words)
        let ranges = try await AIEditService().autoEditRanges(
            words: words, duration: media.duration, aiCuts: finished, url: media.url
        )
        var repaired = original
        try #require(repaired.resetMainTrack(mediaID: mediaID, sourceDuration: media.duration) != nil)
        repaired.removeSourceRanges(ranges, for: mediaID)
        repaired.regenerateCaptions(preservingManualEdits: false)

        func keptIndices(_ project: EditorProject) -> Set<Int> {
            Set(words.indices.filter { index in
                project.clips.contains {
                    $0.mediaID == mediaID && words[index].playbackAnchor >= $0.sourceStart
                        && words[index].playbackAnchor <= $0.sourceEnd
                }
            })
        }
        let actual = keptIndices(repaired)
        try #require(actual == expected, "trimming must preserve the cleaner's selected words")
        let captionIDs = Set(repaired.storedCaptions.flatMap { $0.wordIDs ?? [] })
        try #require(Set(expected.map { words[$0].id }).isSubset(of: captionIDs))
        await MainActor.run {
            let flow = TranscriptFlowCache()
            flow.refresh(for: repaired)
            let renderedWordIDs = Set(flow.tokens.compactMap { token -> UUID? in
                guard case let .word(word) = token else { return nil }
                return word.id
            })
            #expect(Set(words.map(\.id)).isSubset(of: renderedWordIDs),
                    "the transcript tab must include rejected takes as well as kept words")
        }

        let missingBefore = expected.subtracting(keptIndices(original)).sorted()
        print("Replay: \(words.count) source words, \(expected.count) selected, \(actual.count) surviving")
        print("Words missing in saved edit: " + missingBefore.map { "\($0):\(words[$0].text)" }.joined(separator: " "))
        print("Clips: \(original.clips.count) saved, \(repaired.clips.count) repaired")
        for clip in original.clips {
            guard let next = repaired.clips.first(where: {
                $0.mediaID == clip.mediaID && abs($0.sourceStart - clip.sourceStart) < 0.3
            }), next.sourceEnd > clip.sourceEnd + 0.025 else { continue }
            print(String(format: "Release extended: %.3f → %.3f", clip.sourceEnd, next.sourceEnd))
        }

        if let output = environment["ONE_CLICK_REPLAY_OUTPUT"] {
            let directory = URL(filePath: output, directoryHint: .isDirectory)
            // Never overwrite an existing package or the original project.
            try #require(!FileManager.default.fileExists(atPath: directory.path))
            repaired.id = UUID()
            repaired.name = original.name + " repaired"
            repaired.updatedAt = Date()
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(repaired)
            _ = try decoder.decode(EditorProject.self, from: data)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try data.write(to: directory.appending(path: "project.json"), options: .atomic)
            print("Review copy: \(directory.path)")
        }
    }
}
