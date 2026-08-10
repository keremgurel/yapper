@preconcurrency import AVFoundation
import Foundation
@preconcurrency import WebKit

enum TranscriptionPCM {
    static func monoSample(sum: Float, channelCount: Int) -> Int16 {
        guard channelCount > 0 else { return 0 }
        // Apple's AAC decoder can return a camera mix several dB hotter than
        // the encoded program. Keep 6 dB of headroom before quantizing; ASR
        // normalizes level, while clipped consonants cannot be recovered.
        let average = max(-1, min(1, (sum / Float(channelCount)) * 0.5))
        return Int16((average * Float(Int16.max)).rounded())
    }
}

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

    private struct DecodedAudio {
        let pcm: Data
        let sampleRate: Int
    }

    // Keep camera speech detail at its native rate. The previous forced 16 kHz
    // path could smear quiet sentence onsets before ASR heard them.
    private let chunkBytes = 3_000_000
    private let overlapSeconds = 5.0
    private let maximumConcurrentChunks = 4

    func transcribe(
        media: ProjectMedia,
        dictionary: [DictionaryEntry] = []
    ) async throws -> [TranscriptWord] {
        // Before the decode, not after the upload: a signed-out account should
        // cost a sentence, not a minute of chunking and sending.
        try await Self.requireSession()
        let keyterms = TranscriptionDictionary.keyterms(dictionary)
        let decoded = try await decodeAudio(url: media.url)
        let chunks = makeChunks(decoded.pcm, sampleRate: decoded.sampleRate)
        var completed = Array(repeating: [RemoteWord](), count: chunks.count)

        try await withThrowingTaskGroup(of: (Int, [RemoteWord]).self) { group in
            var next = 0
            func enqueue(_ index: Int) {
                let chunk = chunks[index]
                group.addTask {
                    let words = try await Self.transcribeChunk(
                        data: chunk.data,
                        duration: chunk.duration,
                        keyterms: keyterms,
                        baseURL: YapperAPI.baseURL
                    )
                    return (index, words)
                }
            }
            while next < min(maximumConcurrentChunks, chunks.count) {
                enqueue(next)
                next += 1
            }
            while let (index, words) = try await group.next() {
                completed[index] = words
                if next < chunks.count { enqueue(next); next += 1 }
            }
        }

        let heard = mergeTranscribedChunks(chunks: chunks, completed: completed).map {
            TranscriptWord(mediaID: media.id, text: $0.text, start: $0.start, end: $0.end)
        }
        // The creator's own spellings win over what the transcriber heard.
        return TranscriptionDictionary.applied(to: heard, entries: dictionary)
    }

    /// Fails before the work starts when nobody is signed in.
    static func requireSession() async throws {
        guard await YapperAPI.hasSession() else {
            throw NativeEditorError.aiFailed(
                "Sign in from the Cloud Studio tab first. The AI edit runs on your Yapper account."
            )
        }
    }

    func cleanCuts(words: [TranscriptWord]) async throws -> [(Int, Int)] {
        try await Self.requireSession()
        var request = await YapperAPI.authenticatedRequest(
            url: YapperAPI.url(path: "api/clean-transcript")
        )
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
            // Through the one place that knows what a status means to a
            // creator. "HTTP 402" told them nothing: a subscription problem and
            // an empty credit balance are different problems with different
            // fixes, and the body says which one it is.
            throw YapperAPI.failure(
                status: http.statusCode,
                body: data,
                action: "The AI edit"
            )
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

    /// What to remove for a one-click edit: the retakes, the fillers, and the
    /// silence.
    ///
    /// - Parameter url: the media, for measuring where it is actually quiet.
    ///   Word gaps stand in when it cannot be read, which is the old behaviour
    ///   and a good deal gentler.
    func autoEditRanges(
        words: [TranscriptWord],
        duration: Double,
        aiCuts: [(Int, Int)],
        url: URL? = nil
    ) -> [(Double, Double)] {
        var ranges = aiCuts.map { (words[$0.0].start, words[$0.1].end) }
        let retakeRanges = merge(ranges)
        let kept = words.filter { word in
            !retakeRanges.contains { word.midpoint >= $0.0 && word.midpoint <= $0.1 }
        }
        guard let first = kept.first, let last = kept.last else { return retakeRanges }

        // Measured silence, which finds the dead air a transcript hides: a
        // word's end is where it stops being a word, not where the room goes
        // quiet, and a second of flat waveform routinely reads as a 0.2s gap.
        let spoken = kept.map { ($0.start, $0.end) }
        let measured = (url.flatMap { try? LoudnessEnvelope.measure(url: $0) })
            .map { envelope in
                SilenceScan.absorbingIslands(
                    SilenceScan.avoiding(
                        SilenceScan.silentRanges(loudness: envelope.loudness, hop: envelope.hop),
                        words: spoken
                    ),
                    words: spoken,
                    lively: SilenceScan.livelyLine(for: envelope)
                )
            }

        if let measured, !measured.isEmpty {
            ranges.append(contentsOf: measured)
        } else {
            for index in kept.indices.dropLast() {
                let next = kept.index(after: index)
                if kept[next].start - kept[index].end >= 0.20 {
                    let start = kept[index].end + 0.04
                    let end = kept[next].start - 0.03
                    if end > start { ranges.append((start, end)) }
                }
            }
        }
        let fillers = Set(["um", "umm", "uh", "uhh", "uhm", "er", "err", "ah", "ahh", "hmm", "mhm"])
        for word in kept where fillers.contains(normalize(word.text)) {
            ranges.append((word.start, word.end))
        }
        // The ends of a take are dead air rather than rhythm, so they go
        // nearly whole, whichever way the silence was found.
        if first.start >= 0.15 { ranges.append((0, max(0, first.start - 0.03))) }
        if duration - last.end >= 0.15 { ranges.append((last.end + 0.04, duration)) }
        return merge(ranges)
    }

    /// The silence-only pass, for the Auto-trim button.
    func silenceRanges(
        words: [TranscriptWord],
        duration: Double,
        minimumPause: Double = 0.20,
        url: URL? = nil
    ) -> [(Double, Double)] {
        if
            let url,
            let envelope = try? LoudnessEnvelope.measure(url: url),
            !envelope.loudness.isEmpty
        {
            let spoken = words.map { ($0.start, $0.end) }
            var ranges = SilenceScan.absorbingIslands(
                SilenceScan.avoiding(
                    SilenceScan.silentRanges(loudness: envelope.loudness, hop: envelope.hop),
                    words: spoken
                ),
                words: spoken,
                lively: SilenceScan.livelyLine(for: envelope)
            )
            // A take that is silent from end to end is a take with no speech in
            // it, and removing all of it is never what was meant.
            let total = ranges.reduce(0.0) { $0 + ($1.1 - $1.0) }
            if duration > 0, total < duration * 0.98 { return merge(ranges) }
            ranges.removeAll()
        }
        return wordGapSilences(words: words, duration: duration, minimumPause: minimumPause)
    }

    private func wordGapSilences(
        words: [TranscriptWord],
        duration: Double,
        minimumPause: Double
    ) -> [(Double, Double)] {
        let ordered = words.sorted { $0.start < $1.start }
        guard let first = ordered.first, let last = ordered.last else { return [] }
        var ranges: [(Double, Double)] = []
        for index in ordered.indices.dropLast() {
            let next = ordered.index(after: index)
            guard ordered[next].start - ordered[index].end >= minimumPause else { continue }
            let start = ordered[index].end + 0.04
            let end = ordered[next].start - 0.03
            if end > start { ranges.append((start, end)) }
        }
        if first.start >= 0.15 { ranges.append((0, max(0, first.start - 0.03))) }
        if duration - last.end >= 0.15 { ranges.append((last.end + 0.04, duration)) }
        return merge(ranges)
    }

    private func decodeAudio(url: URL) async throws -> DecodedAudio {
        let file: AVAudioFile
        do {
            file = try AVAudioFile(
                forReading: url,
                commonFormat: .pcmFormatFloat32,
                interleaved: false
            )
        } catch {
            throw NativeEditorError.aiFailed("This media has no readable audio to transcribe.")
        }
        let format = file.processingFormat
        let channelCount = Int(format.channelCount)
        guard channelCount > 0 else {
            throw NativeEditorError.aiFailed("This media has no audio channels to transcribe.")
        }
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 32_768) else {
            throw NativeEditorError.aiFailed("The audio decoder could not allocate a buffer.")
        }

        var pcm = Data()
        pcm.reserveCapacity(Int(file.length) * MemoryLayout<Int16>.stride)
        while file.framePosition < file.length {
            buffer.frameLength = 0
            try file.read(into: buffer, frameCount: buffer.frameCapacity)
            let frameCount = Int(buffer.frameLength)
            guard frameCount > 0, let channels = buffer.floatChannelData else { break }
            var mono = [Int16](repeating: 0, count: frameCount)
            for frame in 0 ..< frameCount {
                var sum: Float = 0
                for channel in 0 ..< channelCount { sum += channels[channel][frame] }
                mono[frame] = TranscriptionPCM.monoSample(
                    sum: sum,
                    channelCount: channelCount
                ).littleEndian
            }
            mono.withUnsafeBytes { pcm.append(contentsOf: $0) }
        }
        guard !pcm.isEmpty else {
            throw NativeEditorError.aiFailed("Audio decoding returned no samples.")
        }
        return DecodedAudio(pcm: pcm, sampleRate: Int(format.sampleRate.rounded()))
    }

    private func makeChunks(_ pcm: Data, sampleRate: Int) -> [AudioChunk] {
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

    private static func transcribeChunk(
        data chunkData: Data,
        duration: Double,
        keyterms: [String],
        baseURL: URL
    ) async throws -> [RemoteWord] {
        var lastError: Error?
        for attempt in 0 ..< 3 {
            do {
                var request = await YapperAPI.authenticatedRequest(
                    url: transcribeURL(baseURL: baseURL, keyterms: keyterms)
                )
                request.httpMethod = "POST"
                request.timeoutInterval = 120
                request.setValue("audio/wav", forHTTPHeaderField: "Content-Type")
                request.setValue(String(duration), forHTTPHeaderField: "x-audio-duration")
                request.httpBody = chunkData
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
                    let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                    throw YapperAPI.failure(status: code, body: data, action: "Transcription")
                }
                return try JSONDecoder().decode(TranscriptionResponse.self, from: data).words ?? []
            } catch {
                lastError = error
                if attempt < 2 {
                    try? await Task.sleep(for: .milliseconds(attempt == 0 ? 350 : 900))
                }
            }
        }
        throw lastError ?? NativeEditorError.aiFailed("Transcription failed.")
    }

    /// The transcribe route takes the creator's terms up front, one query item
    /// each, so the transcriber is listening for them rather than only being
    /// corrected afterwards.
    private static func transcribeURL(baseURL: URL, keyterms: [String]) -> URL {
        let url = baseURL.appending(path: "api/transcribe")
        guard
            !keyterms.isEmpty,
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return url }
        components.queryItems = keyterms.map { URLQueryItem(name: "keyterm", value: $0) }
        return components.url ?? url
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
        return restoreUnrepresentedSeamWords(
            in: merged.filter { !normalize($0.text).isEmpty },
            from: shifted
        )
    }

    /// Midpoint ownership is deterministic, but a provider pass can omit a
    /// quiet word that the overlapping pass heard. Restore only words whose
    /// time is otherwise uncovered so alternate spellings are not duplicated.
    private func restoreUnrepresentedSeamWords(
        in merged: [RemoteWord],
        from shiftedChunks: [[RemoteWord]]
    ) -> [RemoteWord] {
        var result = merged
        for candidate in shiftedChunks.flatMap({ $0 }).sorted(by: { $0.start < $1.start }) {
            let token = normalize(candidate.text)
            guard !token.isEmpty else { continue }
            let candidateMidpoint = midpoint(candidate)
            let alreadyRepresented = result.contains {
                normalize($0.text) == token && abs(midpoint($0) - candidateMidpoint) <= 0.55
            }
            if alreadyRepresented { continue }

            let padding = max(0.08, min(0.22, (candidate.end - candidate.start) * 0.45))
            let occupiedByAlternative = result.contains {
                midpoint($0) >= candidate.start - padding && midpoint($0) <= candidate.end + padding
            }
            if !occupiedByAlternative { result.append(candidate) }
        }
        return result.sorted {
            if abs($0.start - $1.start) > 0.000_1 { return $0.start < $1.start }
            return $0.end < $1.end
        }
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

        // The safe contiguous mapper can be off by one at a take boundary
        // when the critic omits a tiny but audible source word. Restore that
        // single connected word when it is either a real phrase starter or it
        // follows the already-kept take. This recovers "You have", "Building
        // the app", and "tests, drill individual" without pulling an entire
        // abandoned phrase back into the edit.
        for keptStart in words.indices where !removed[keptStart] && keptStart > 0 && removed[keptStart - 1] {
            let candidate = keptStart - 1
            let token = normalize(words[candidate].text)
            let nextToken = normalize(words[keptStart].text)
            let followsKeptTake = candidate > 0 && !removed[candidate - 1]
            let connected = words[keptStart].start - words[candidate].end <= 0.32
            let duplicatesJoin = token == nextToken
            let invalidDeterminerJoin = determiners.contains(token) && pronouns.contains(nextToken)
            guard !token.isEmpty,
                  connected,
                  !isSentenceEnd(words[candidate].text),
                  !fillers.contains(token),
                  !duplicatesJoin,
                  !invalidDeterminerJoin,
                  followsKeptTake || phraseStarters.contains(token)
            else { continue }
            removed[candidate] = false
        }

        restoreShavedTakeOpenings(words: words, removed: &removed)
        repairOrphanedKeptFragments(words: words, removed: &removed)

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

    /// Give the final take back the word it opened with.
    ///
    /// Every attempt at a line starts with the same words, so a matcher scoring
    /// the last attempt can score a window starting one word into it almost as
    /// well and take that instead. What survives then opens mid-phrase: the
    /// speaker's "Stop trying to memorize..." arrives as "trying to
    /// memorize...", with the "Stop" they actually said sitting on the cut side
    /// of the boundary.
    ///
    /// The tell is that the phrase reads on from the removed word into the take
    /// exactly as an earlier, abandoned attempt did. That is the speaker saying
    /// the same line again, not two attempts being stitched together, so the
    /// word belongs to the take. Anything short of a whole repeated phrase, a
    /// break in the speech, or a sentence that has already ended, leaves the
    /// boundary alone.
    private static func restoreShavedTakeOpenings(
        words: [TranscriptWord],
        removed: inout [Bool]
    ) {
        let tokens = words.map { normalize($0.text) }
        for keptStart in words.indices where !removed[keptStart] && keptStart > 0 && removed[keptStart - 1] {
            var opening = keptStart
            let takeEnd = (opening ..< words.count).first { removed[$0] } ?? words.count
            while opening > 0, removed[opening - 1], keptStart - opening < maximumShavedOpening {
                let candidate = opening - 1
                guard !tokens[candidate].isEmpty,
                      !isSentenceEnd(words[candidate].text),
                      words[opening].start - words[candidate].end <= 0.32,
                      repeatsAnAbandonedAttempt(
                          from: candidate,
                          through: takeEnd,
                          tokens: tokens,
                          removed: removed
                      )
                else { break }
                removed[candidate] = false
                opening = candidate
            }
        }
    }

    /// At most this many words, so a boundary that is wrong for some other
    /// reason cannot drag a whole abandoned attempt back into the edit.
    private static let maximumShavedOpening = 4
    /// Enough words that matching one is the speaker repeating a line rather
    /// than a turn of phrase they happen to use twice.
    private static let repeatedPhraseLength = 6

    private static func repeatsAnAbandonedAttempt(
        from candidate: Int,
        through takeEnd: Int,
        tokens: [String],
        removed: [Bool]
    ) -> Bool {
        let length = min(repeatedPhraseLength, takeEnd - candidate)
        guard length >= 3, candidate >= length else { return false }
        let phrase = Array(tokens[candidate ..< candidate + length])
        guard !phrase.contains(where: \.isEmpty) else { return false }
        return (0 ... candidate - length).contains { start in
            Array(tokens[start ..< start + length]) == phrase
                && (start ..< start + length).allSatisfy { removed[$0] }
        }
    }

    /// A semantic response can occasionally end its final cut one token too
    /// early, leaving only the last word of a repeated take (for example the
    /// isolated "practice." observed in the DJI regression clip). Such an
    /// island produces a visible and audible zombie clip. Prefer the nearest
    /// complete matching sentence inside the removed retake; if there is no
    /// complete candidate, remove the fragment instead of splicing it into the
    /// final video.
    private static func repairOrphanedKeptFragments(
        words: [TranscriptWord],
        removed: inout [Bool]
    ) {
        guard words.count == removed.count, words.count >= 4 else { return }

        var keptRuns: [ClosedRange<Int>] = []
        var runStart: Int?
        for index in words.indices {
            if !removed[index], runStart == nil { runStart = index }
            if removed[index], let start = runStart {
                keptRuns.append(start ... index - 1)
                runStart = nil
            }
        }
        if let runStart { keptRuns.append(runStart ... words.count - 1) }

        for run in keptRuns {
            let isTail = run.upperBound == words.count - 1
            let surrounded = run.lowerBound > 0 && run.upperBound < words.count - 1
            let tokenCount = run.count
            let boundaryGap = run.lowerBound > 0
                ? words[run.lowerBound].start - words[run.lowerBound - 1].end
                : 0
            let isDetachedFragment = (isTail && tokenCount <= 2 && boundaryGap >= 0.5)
                || (surrounded && tokenCount == 1 && boundaryGap >= 0.5)
            guard isDetachedFragment else { continue }

            let otherKeptCount = removed.indices.filter {
                !removed[$0] && !run.contains($0)
            }.count
            guard otherKeptCount >= 3 else { continue }

            let finalToken = normalize(words[run.upperBound].text)
            var removedRunStart = run.lowerBound - 1
            while removedRunStart > 0, removed[removedRunStart - 1] {
                removedRunStart -= 1
            }
            let candidateEnd = (removedRunStart ..< run.lowerBound).reversed().first {
                normalize(words[$0].text) == finalToken && isSentenceEnd(words[$0].text)
            }

            for index in run { removed[index] = true }
            guard let candidateEnd else { continue }

            var candidateStart = candidateEnd
            while candidateStart > removedRunStart,
                  candidateEnd - candidateStart < 19,
                  !isSentenceEnd(words[candidateStart - 1].text)
            {
                candidateStart -= 1
            }
            let candidateCount = candidateEnd - candidateStart + 1
            let candidateDuration = words[candidateEnd].end - words[candidateStart].start
            guard candidateCount >= 3, candidateDuration <= 10 else { continue }
            for index in candidateStart ... candidateEnd { removed[index] = false }
        }
    }

    private static func normalize(_ text: String) -> String {
        text.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" }
    }

    private static func isSentenceEnd(_ text: String) -> Bool {
        text.range(of: "[.!?][\\\"')\\]]*$", options: .regularExpression) != nil
    }
}
