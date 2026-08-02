@preconcurrency import AVFoundation
import Foundation

actor AIEditService {
    private struct RemoteWord: Codable {
        let text: String
        let start: Double
        let end: Double
    }

    private struct TranscriptionResponse: Codable {
        let words: [RemoteWord]?
    }

    private struct CleanRequest: Codable {
        struct Word: Codable { let text: String }
        let words: [Word]
    }

    private struct CleanResponse: Codable {
        let cuts: [[Int]]?
        let error: String?
    }

    private struct AudioChunk {
        let data: Data
        let offset: Double
        let duration: Double
    }

    private let sampleRate = 16_000
    private let chunkBytes = 1_000_000
    private let overlapSeconds = 5.0
    private let defaultBaseURL = URL(string: "https://ypr.app")!

    func transcribe(media: ProjectMedia) async throws -> [TranscriptWord] {
        let pcm = try await decodeMonoPCM16(url: media.url)
        let chunks = makeChunks(pcm)
        var completed = Array(repeating: [RemoteWord](), count: chunks.count)

        try await withThrowingTaskGroup(of: (Int, [RemoteWord]).self) { group in
            var next = 0
            func enqueue(_ index: Int) {
                let chunk = chunks[index]
                group.addTask { [defaultBaseURL] in
                    let words = try await Self.transcribeChunk(chunk, baseURL: defaultBaseURL)
                    return (index, words)
                }
            }
            while next < min(2, chunks.count) { enqueue(next); next += 1 }
            while let (index, words) = try await group.next() {
                completed[index] = words
                if next < chunks.count { enqueue(next); next += 1 }
            }
        }

        return mergeTranscribedChunks(chunks: chunks, completed: completed).map {
            TranscriptWord(mediaID: media.id, text: $0.text, start: $0.start, end: $0.end)
        }
    }

    func cleanCuts(words: [TranscriptWord]) async throws -> [(Int, Int)] {
        var request = URLRequest(url: defaultBaseURL.appending(path: "api/clean-transcript"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            CleanRequest(words: words.map { .init(text: $0.text) })
        )
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw NativeEditorError.aiFailed("The AI service returned no response.")
        }
        if http.statusCode == 501 {
            return RetakeCutBoundaryRepair.repaired(words: words, cuts: deterministicRetakeCuts(words))
        }
        guard (200 ..< 300).contains(http.statusCode) else {
            let detail = (try? JSONDecoder().decode(CleanResponse.self, from: data).error) ?? "HTTP \(http.statusCode)"
            throw NativeEditorError.aiFailed("Retake analysis failed: \(detail)")
        }
        let decoded = try JSONDecoder().decode(CleanResponse.self, from: data)
        let cuts = (decoded.cuts ?? []).compactMap { pair -> (Int, Int)? in
            guard pair.count == 2, words.indices.contains(pair[0]), words.indices.contains(pair[1]) else {
                return nil
            }
            return (pair[0], pair[1])
        }
        return RetakeCutBoundaryRepair.repaired(
            words: words,
            cuts: cuts.isEmpty ? deterministicRetakeCuts(words) : cuts
        )
    }

    func autoEditRanges(
        words: [TranscriptWord],
        duration: Double,
        aiCuts: [(Int, Int)]
    ) -> [(Double, Double)] {
        var ranges = aiCuts.map { (words[$0.0].start, words[$0.1].end) }
        let retakeRanges = merge(ranges)
        let kept = words.filter { word in
            !retakeRanges.contains { word.midpoint >= $0.0 && word.midpoint <= $0.1 }
        }
        guard let first = kept.first, let last = kept.last else { return retakeRanges }

        for index in kept.indices.dropLast() {
            let next = kept.index(after: index)
            if kept[next].start - kept[index].end >= 0.25 {
                let start = kept[index].end + 0.06
                let end = kept[next].start - 0.04
                if end > start { ranges.append((start, end)) }
            }
        }
        let fillers = Set(["um", "umm", "uh", "uhh", "uhm", "er", "err", "ah", "ahh", "hmm", "mhm"])
        for word in kept where fillers.contains(normalize(word.text)) {
            ranges.append((word.start, word.end))
        }
        if first.start >= 0.4 { ranges.append((0, max(0, first.start - 0.04))) }
        if duration - last.end >= 0.4 { ranges.append((last.end + 0.06, duration)) }
        return merge(ranges)
    }

    func silenceRanges(
        words: [TranscriptWord],
        duration: Double,
        minimumPause: Double = 0.30
    ) -> [(Double, Double)] {
        let ordered = words.sorted { $0.start < $1.start }
        guard let first = ordered.first, let last = ordered.last else { return [] }
        var ranges: [(Double, Double)] = []
        for index in ordered.indices.dropLast() {
            let next = ordered.index(after: index)
            guard ordered[next].start - ordered[index].end >= minimumPause else { continue }
            let start = ordered[index].end + 0.06
            let end = ordered[next].start - 0.04
            if end > start { ranges.append((start, end)) }
        }
        if first.start >= 0.4 { ranges.append((0, max(0, first.start - 0.04))) }
        if duration - last.end >= 0.4 { ranges.append((last.end + 0.06, duration)) }
        return merge(ranges)
    }

    private func decodeMonoPCM16(url: URL) async throws -> Data {
        let asset = AVURLAsset(url: url)
        guard let track = try await asset.loadTracks(withMediaType: .audio).first else {
            throw NativeEditorError.aiFailed("This media has no audio to transcribe.")
        }
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [
                AVFormatIDKey: kAudioFormatLinearPCM,
                AVSampleRateKey: sampleRate,
                AVNumberOfChannelsKey: 1,
                AVLinearPCMBitDepthKey: 16,
                AVLinearPCMIsFloatKey: false,
                AVLinearPCMIsBigEndianKey: false,
                AVLinearPCMIsNonInterleaved: false,
            ]
        )
        output.alwaysCopiesSampleData = false
        guard reader.canAdd(output) else {
            throw NativeEditorError.aiFailed("The audio decoder could not read this file.")
        }
        reader.add(output)
        guard reader.startReading() else {
            throw reader.error ?? NativeEditorError.aiFailed("Audio decoding did not start.")
        }
        var pcm = Data()
        while reader.status == .reading, let buffer = output.copyNextSampleBuffer() {
            guard let block = CMSampleBufferGetDataBuffer(buffer) else { continue }
            let length = CMBlockBufferGetDataLength(block)
            let oldCount = pcm.count
            pcm.count += length
            let status = pcm.withUnsafeMutableBytes { bytes in
                CMBlockBufferCopyDataBytes(
                    block,
                    atOffset: 0,
                    dataLength: length,
                    destination: bytes.baseAddress!.advanced(by: oldCount)
                )
            }
            guard status == kCMBlockBufferNoErr else {
                throw NativeEditorError.aiFailed("Audio decoding returned incomplete data.")
            }
        }
        if reader.status == .failed {
            throw reader.error ?? NativeEditorError.aiFailed("Audio decoding failed.")
        }
        return pcm
    }

    private func makeChunks(_ pcm: Data) -> [AudioChunk] {
        guard !pcm.isEmpty else { return [] }
        let bytesPerSecond = sampleRate * 2
        let overlap = Int(overlapSeconds * Double(bytesPerSecond))
        let advance = max(2, chunkBytes - overlap)
        var result: [AudioChunk] = []
        var start = 0
        while start < pcm.count {
            let end = min(pcm.count, start + chunkBytes)
            let payload = Data(pcm[start ..< end])
            result.append(
                AudioChunk(
                    data: Self.wav(pcm: payload, sampleRate: sampleRate),
                    offset: Double(start) / Double(bytesPerSecond),
                    duration: Double(payload.count) / Double(bytesPerSecond)
                )
            )
            if end == pcm.count { break }
            start += advance
        }
        return result
    }

    private static func transcribeChunk(_ chunk: AudioChunk, baseURL: URL) async throws -> [RemoteWord] {
        var request = URLRequest(url: baseURL.appending(path: "api/transcribe"))
        request.httpMethod = "POST"
        request.setValue("audio/wav", forHTTPHeaderField: "Content-Type")
        request.setValue(String(chunk.duration), forHTTPHeaderField: "x-audio-duration")
        request.httpBody = chunk.data
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw NativeEditorError.aiFailed("Transcription failed (HTTP \(code)).")
        }
        return try JSONDecoder().decode(TranscriptionResponse.self, from: data).words ?? []
    }

    private func mergeTranscribedChunks(
        chunks: [AudioChunk],
        completed: [[RemoteWord]]
    ) -> [RemoteWord] {
        guard !chunks.isEmpty, chunks.count == completed.count else { return [] }
        let shifted = zip(chunks, completed).map { chunk, words in
            words.map {
                RemoteWord(text: $0.text, start: $0.start + chunk.offset, end: $0.end + chunk.offset)
            }
        }
        var merged = shifted[0]
        for index in 1 ..< shifted.count {
            let left = shifted[index - 1]
            let right = shifted[index]
            let seam = (chunks[index].offset + chunks[index - 1].offset + chunks[index - 1].duration) / 2
            let anchor = seamAnchor(left: left, right: right, seam: seam)
            let rightOwnsPrefix = anchor.map { anchor in
                right[..<anchor.right].contains { midpoint($0) >= seam }
            } ?? false

            if let anchor, !rightOwnsPrefix {
                let trailing = left.count - anchor.left - 1
                if trailing > 0 { merged.removeLast(min(trailing, merged.count)) }
                merged.append(contentsOf: right.dropFirst(anchor.right + 1))
            } else {
                while let last = merged.last, midpoint(last) >= seam { merged.removeLast() }
                merged.append(contentsOf: right.filter { midpoint($0) >= seam })
            }
        }
        return merged.filter { !normalize($0.text).isEmpty }
    }

    private func seamAnchor(
        left: [RemoteWord],
        right: [RemoteWord],
        seam: Double
    ) -> (left: Int, right: Int)? {
        var best: ((Int, Int), Double)?
        for leftIndex in left.indices {
            let token = normalize(left[leftIndex].text)
            guard !token.isEmpty, abs(midpoint(left[leftIndex]) - seam) <= 3 else { continue }
            for rightIndex in right.indices where normalize(right[rightIndex].text) == token {
                let delta = abs(midpoint(left[leftIndex]) - midpoint(right[rightIndex]))
                guard delta <= 1.5 else { continue }
                var context = 0
                for offset in -2 ... 2 {
                    let a = left.indices.contains(leftIndex + offset) ? normalize(left[leftIndex + offset].text) : ""
                    let b = right.indices.contains(rightIndex + offset) ? normalize(right[rightIndex + offset].text) : ""
                    if !a.isEmpty, a == b { context += 1 }
                }
                guard context >= 2 || (token.count >= 5 && delta <= 0.35) else { continue }
                let seamDistance = abs((midpoint(left[leftIndex]) + midpoint(right[rightIndex])) / 2 - seam)
                let score = Double(context * 10) - delta - seamDistance * 0.1
                if best == nil || score > best!.1 { best = ((leftIndex, rightIndex), score) }
            }
        }
        return best.map { (left: $0.0.0, right: $0.0.1) }
    }

    private func midpoint(_ word: RemoteWord) -> Double { (word.start + word.end) / 2 }

    private func deterministicRetakeCuts(_ words: [TranscriptWord]) -> [(Int, Int)] {
        guard words.count >= 8 else { return [] }
        let tokens = words.map { normalize($0.text) }
        var cuts: [(Int, Int)] = []
        var index = 0
        while index + 4 <= tokens.count {
            let phrase = Array(tokens[index ..< index + 4])
            var repeated: Int?
            for candidate in (index + 1) ... max(index + 1, tokens.count - 4) {
                guard candidate + 4 <= tokens.count else { break }
                if words[candidate].start - words[index].start > 25 { break }
                if Array(tokens[candidate ..< candidate + 4]) == phrase {
                    repeated = candidate
                    break
                }
            }
            if let repeated {
                cuts.append((index, max(index, repeated - 1)))
                index = repeated
            } else {
                index += 1
            }
        }
        return cuts
    }

    private func merge(_ ranges: [(Double, Double)]) -> [(Double, Double)] {
        let sorted = ranges.filter { $0.1 > $0.0 }.sorted { $0.0 < $1.0 }
        guard var current = sorted.first else { return [] }
        var result: [(Double, Double)] = []
        for range in sorted.dropFirst() {
            if range.0 <= current.1 + 0.06 { current.1 = max(current.1, range.1) }
            else { result.append(current); current = range }
        }
        result.append(current)
        return result
    }

    private func normalize(_ text: String) -> String {
        text.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" }
    }

    private static func wav(pcm: Data, sampleRate: Int) -> Data {
        var data = Data()
        func append<T: FixedWidthInteger>(_ value: T) {
            var little = value.littleEndian
            withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
        }
        data.append(contentsOf: "RIFF".utf8)
        append(UInt32(36 + pcm.count))
        data.append(contentsOf: "WAVEfmt ".utf8)
        append(UInt32(16)); append(UInt16(1)); append(UInt16(1))
        append(UInt32(sampleRate)); append(UInt32(sampleRate * 2))
        append(UInt16(2)); append(UInt16(16))
        data.append(contentsOf: "data".utf8)
        append(UInt32(pcm.count))
        data.append(pcm)
        return data
    }
}

enum RetakeCutBoundaryRepair {
    private static let discourseStarters = Set([
        "and", "but", "so", "now", "then", "because", "plus", "also", "finally",
    ])
    private static let phraseStarters = discourseStarters.union([
        "i", "i'm", "i've", "i'll", "we", "we're", "we've", "you", "you're", "you've",
        "he", "she", "they", "it", "this", "that", "these", "those", "the", "a", "an",
    ])
    private static let determiners = Set(["the", "a", "an", "this", "that", "these", "those"])
    private static let pronouns = Set(["i", "i'm", "i've", "i'll", "we", "you", "he", "she", "they", "it"])
    private static let fillers = Set(["um", "umm", "uh", "uhh", "uhm", "er", "err", "ah", "ahh", "hmm", "mhm"])

    /// The semantic cleaner chooses whole takes, but an exact-text alignment can
    /// still leave a short spoken lead-in on the cut side of the boundary. Keep
    /// only tightly connected, non-duplicated starters; never join arbitrary
    /// words from two attempts.
    static func repaired(words: [TranscriptWord], cuts: [(Int, Int)]) -> [(Int, Int)] {
        guard !words.isEmpty, !cuts.isEmpty else { return cuts }
        var removed = Array(repeating: false, count: words.count)
        for cut in cuts {
            let lower = max(0, min(cut.0, cut.1))
            let upper = min(words.count - 1, max(cut.0, cut.1))
            guard lower <= upper else { continue }
            for index in lower ... upper { removed[index] = true }
        }

        if let firstKept = removed.firstIndex(of: false), (1 ... 3).contains(firstKept) {
            let prefix = Array(words[0 ..< firstKept])
            let continuous = zip(prefix, words[1 ... firstKept]).allSatisfy {
                $1.start - $0.end <= 0.32
            }
            let tokens = prefix.map { normalize($0.text) }
            let safePrefix = continuous &&
                words[firstKept - 1].end - words[0].start <= 1.4 &&
                tokens.allSatisfy { !fillers.contains($0) } &&
                !tokens.contains(normalize(words[firstKept].text))
            if safePrefix {
                for index in 0 ..< firstKept { removed[index] = false }
            }
        }

        for keptStart in words.indices where !removed[keptStart] && keptStart > 0 && removed[keptStart - 1] {
            var removedRunStart = keptStart - 1
            while removedRunStart > 0, removed[removedRunStart - 1] {
                removedRunStart -= 1
            }
            var candidateStart = max(removedRunStart, keptStart - 4)
            if candidateStart < keptStart - 1 {
                for index in candidateStart ..< keptStart - 1 where isSentenceEnd(words[index].text) {
                    candidateStart = index + 1
                }
            }
            let suffix = Array(words[candidateStart ..< keptStart])
            let connected = zip(suffix, words[(candidateStart + 1) ... keptStart]).allSatisfy {
                preceding, following in following.start - preceding.end <= 0.32
            }
            guard !suffix.isEmpty,
                  connected,
                  suffix.last!.end - suffix.first!.start <= 1.4
            else { continue }

            let suffixTokens = suffix.map { normalize($0.text) }
            let nextToken = normalize(words[keptStart].text)
            let startsAsLeadIn = phraseStarters.contains(suffixTokens[0])
            let endsAsIntro = suffix.last!.text.range(of: "[,;:]$", options: .regularExpression) != nil
            let duplicatesJoin = suffixTokens.last == nextToken
            let invalidDeterminerJoin = determiners.contains(suffixTokens.last ?? "") && pronouns.contains(nextToken)
            let containsFiller = suffixTokens.contains { fillers.contains($0) }
            guard (startsAsLeadIn || endsAsIntro),
                  !duplicatesJoin,
                  !invalidDeterminerJoin,
                  !containsFiller
            else { continue }
            for index in candidateStart ..< keptStart { removed[index] = false }
        }

        var repaired: [(Int, Int)] = []
        var start: Int?
        for index in words.indices {
            if removed[index], start == nil { start = index }
            if !removed[index], let runStart = start {
                repaired.append((runStart, index - 1))
                start = nil
            }
        }
        if let start { repaired.append((start, words.count - 1)) }
        return repaired
    }

    private static func normalize(_ text: String) -> String {
        text.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" }
    }

    private static func isSentenceEnd(_ text: String) -> Bool {
        text.range(of: "[.!?][\\\"')\\]]*$", options: .regularExpression) != nil
    }
}
