import Foundation
import Testing
@testable import YapperNative

struct UnresolvedSpeechTests {
    @Test("the reported half-second survives retake cuts and project reopening")
    func reportedGap() async throws {
        let mediaID = UUID()
        let words = [
            TranscriptWord(mediaID: mediaID, text: "first", start: 520, end: 521),
            TranscriptWord(mediaID: mediaID, text: "last", start: 528, end: 529),
            TranscriptWord(mediaID: mediaID, text: "kept", start: 532, end: 533),
        ]
        var project = EditorProject(
            clips: [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 540)],
            transcript: words
        )
        project.unresolvedTranscriptionSpeech = [mediaID.uuidString: [[525.625, 526.125]]]
        let data = try JSONEncoder().encode(project)
        project = try JSONDecoder().decode(EditorProject.self, from: data)
        let protected = project.unresolvedTranscriptionSpeech?[mediaID.uuidString] ?? []
        let cuts = try await AIEditService().autoEditRanges(
            words: words, duration: 540, aiCuts: [(0, 1)], unresolvedSpeech: protected
        )
        #expect(cuts.isEmpty)
        project.removeSourceRanges(cuts, for: mediaID)
        #expect(project.clips.contains { $0.sourceStart <= 525.625 && $0.sourceEnd >= 526.125 })
        #expect(project.transcript == words)
    }

    @Test("uncertainty prevents silence trimming, including quiet speech")
    func quietSpeech() async throws {
        let url = FileManager.default.temporaryDirectory.appending(path: "uncertain-\(UUID()).wav")
        defer { try? FileManager.default.removeItem(at: url) }
        // A local quiet waveform would normally authorize a silence cut.
        try Self.wav().write(to: url)
        let words = [TranscriptWord(mediaID: UUID(), text: "hello", start: 0.1, end: 0.4)]
        let service = AIEditService()
        let usual = try await service.silenceRanges(words: words, duration: 5, url: url)
        #expect(usual.contains { $0.0 < 2 && $0.1 > 2.5 })
        let safe = try await service.silenceRanges(
            words: words, duration: 5, url: url, unresolvedSpeech: [[2, 2.5]]
        )
        #expect(!safe.contains { $0.0 < 2.5 && $0.1 > 2 })
    }

    @Test("unrelated edits proceed and no placeholder captions are invented")
    func unrelatedCuts() {
        let cuts = UnresolvedSpeech.protecting([[2, 2.5]], from: [(0, 1), (1.5, 3), (4, 5)], words: [])
        #expect(cuts.map { [$0.0, $0.1] } == [[0, 1], [4, 5]])
    }

    @Test("projects saved before uncertainty metadata still load")
    func oldProject() throws {
        let data = try JSONEncoder().encode(EditorProject())
        let project = try JSONDecoder().decode(EditorProject.self, from: data)
        #expect(project.unresolvedTranscriptionSpeech == nil)
    }

    private static func wav() -> Data {
        let sampleRate = 16_000
        let samples: [Int16] = (0 ..< sampleRate * 5).map { i in
            i < sampleRate || i > sampleRate * 4 ? Int16(sin(Double(i) * 0.1) * 12_000) : 0
        }
        var data = Data()
        func text(_ s: String) { data.append(contentsOf: s.utf8) }
        func u32(_ n: UInt32) { var n = n.littleEndian; withUnsafeBytes(of: &n) { data.append(contentsOf: $0) } }
        func u16(_ n: UInt16) { var n = n.littleEndian; withUnsafeBytes(of: &n) { data.append(contentsOf: $0) } }
        text("RIFF"); u32(UInt32(36 + samples.count * 2)); text("WAVEfmt ")
        u32(16); u16(1); u16(1); u32(UInt32(sampleRate)); u32(UInt32(sampleRate * 2)); u16(2); u16(16)
        text("data"); u32(UInt32(samples.count * 2))
        for sample in samples { u16(UInt16(bitPattern: sample)) }
        return data
    }
}
