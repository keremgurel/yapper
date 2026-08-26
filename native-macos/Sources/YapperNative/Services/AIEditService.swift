@preconcurrency import AVFoundation
import Foundation
@preconcurrency import WebKit

enum TranscriptionPCM {
    static func monoSample(sum: Float, channelCount: Int) -> Int16 {
        guard channelCount > 0 else { return 0 }
        // At the level it was recorded. The 6 dB of headroom this used to take
        // was meant to protect against a hot camera mix, and it cost words:
        // measured on a real take, the same audio transcribed at full level
        // gave 475 words and attenuated gave 447, and the missing ones were
        // not quiet asides. A lossy encoder spends its bits relative to the
        // signal it is given, so quieting the speech first is throwing detail
        // away before the encoder ever sees it. Even 1.5 dB cost 31 words.
        // Clipping is still clamped rather than wrapped.
        let average = max(-1, min(1, sum / Float(channelCount)))
        return Int16((average * Float(Int16.max)).rounded())
    }
}

enum TranscriptionTemporaryFile {
    static func withPCMFile<Result: Sendable>(
        isolation _: isolated (any Actor)? = #isolation,
        _ operation: (URL) async throws -> Result
    ) async throws -> Result {
        let url = FileManager.default.temporaryDirectory
            .appending(path: "yapper-transcription-\(UUID().uuidString).pcm")
        guard FileManager.default.createFile(atPath: url.path, contents: nil) else {
            throw NativeEditorError.aiFailed("The audio decoder could not create its temporary file.")
        }
        defer { try? FileManager.default.removeItem(at: url) }
        return try await operation(url)
    }
}

actor AIEditService {
    private static func purgeStaleTranscriptionFiles() {
        let directory = FileManager.default.temporaryDirectory
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: [.contentModificationDateKey]
        ) else { return }
        let cutoff = Date().addingTimeInterval(-24 * 60 * 60)
        for file in files where file.lastPathComponent.hasPrefix("yapper-transcription-") && file.pathExtension == "pcm" {
            let modified = try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
            if modified.map({ $0 < cutoff }) != false { try? FileManager.default.removeItem(at: file) }
        }
    }
    private struct RemoteWord: Codable {
        let text: String
        let start: Double
        let end: Double
    }

    private struct TranscriptionResponse: Codable {
        let words: [RemoteWord]?
    }

    private struct UploadTicketRequest: Codable { let bytes: Int }

    private struct UploadTicket: Codable {
        let key: String
        let url: String
    }

    private struct StoredTranscriptionRequest: Codable { let key: String }

    private struct CleanRequest: Codable {
        /// The timings go with the words so the server can split a long take at
        /// a silence the speaker actually left, rather than at a word count
        /// that could fall between two attempts at the same line.
        struct Word: Codable {
            let text: String
            let start: Double
            let end: Double
        }
        let words: [Word]
    }

    private struct CleanResponse: Codable {
        let cuts: [[Int]]?
        let error: String?
    }

    private struct DecodedAudio {
        let url: URL
        let byteCount: Int
        let sampleRate: Int
    }

    // Keep camera speech detail at its native rate. The previous forced 16 kHz
    // path could smear quiet sentence onsets before ASR heard them.

    /// How loud each take was, moment by moment, kept from the decode the
    /// transcriber already paid for. Reading a fifteen minute take off a camera
    /// card again costs about half a minute, and the answer would be identical.
    private var envelopes: [URL: LoudnessEnvelope.Envelope] = [:]

    private func envelope(for url: URL?) -> LoudnessEnvelope.Envelope? {
        guard let url else { return nil }
        if let known = envelopes[url] { return known }
        guard let measured = try? LoudnessEnvelope.measure(url: url) else { return nil }
        envelopes[url] = measured
        return measured
    }

    private func knowsEnvelope(for url: URL) -> Bool { envelopes[url] != nil }

    private func remember(_ envelope: LoudnessEnvelope.Envelope, for url: URL) {
        envelopes[url] = envelope
    }

    /// Reads how loud the take is, moment by moment, before anything asks.
    ///
    /// The silence pass cannot begin until the file has been read end to end,
    /// which on a take still sitting on a camera card is most of a minute, and
    /// on a project that was transcribed in an earlier session nothing has read
    /// it yet. None of that reading depends on what the model decides, so it
    /// happens while the model is still thinking rather than after.
    ///
    /// Deliberately not isolated: the read is a solid block of CPU work, and
    /// holding the actor through it would stall the very call it is meant to
    /// run alongside. Only the cache lookup and the write are on the actor.
    nonisolated func warmEnvelope(url: URL) async {
        if await knowsEnvelope(for: url) { return }
        guard !Task.isCancelled, let measured = try? LoudnessEnvelope.measure(url: url) else { return }
        await remember(measured, for: url)
    }

    func transcribe(
        media: ProjectMedia,
        dictionary: [DictionaryEntry] = [],
        progress: (@MainActor @Sendable (Double) -> Void)? = nil
    ) async throws -> [TranscriptWord] {
        // Before the decode, not after the upload: a signed-out account should
        // cost a sentence, not a minute of chunking and sending.
        try await Self.requireSession()
        Self.purgeStaleTranscriptionFiles()
        let keyterms = TranscriptionDictionary.keyterms(dictionary)
        return try await TranscriptionTemporaryFile.withPCMFile { temporaryURL in
            let decoded = try await decodeAudio(
                url: media.url, output: temporaryURL, progress: progress
            )
            // The whole take, in one piece. It used to be cut into upload-sized
            // chunks and the answers stitched back together, because the audio
            // went through the API and the host refuses a body over 4.5 MB. It
            // does not go through the API any more, so there is nothing to cut
            // it for, and the seam between two chunks was somewhere a word
            // could go missing.
            let payload = try Self.compressedChunk(
                at: decoded.url, start: 0, length: decoded.byteCount,
                sampleRate: decoded.sampleRate
            )
            await progress?(0.45)
            let key = try await Self.uploadForTranscription(
                payload, baseURL: YapperAPI.baseURL
            )
            await progress?(0.6)
            let spoken = try await Self.transcribeStored(
                key: key, keyterms: keyterms, baseURL: YapperAPI.baseURL
            )
            await progress?(1)

            let heard = HeardWords.withoutDoubledEmissions(
                spoken.map {
                    TranscriptWord(mediaID: media.id, text: $0.text, start: $0.start, end: $0.end)
                }
            )
            // The creator's own spellings win over what the transcriber heard.
            return TranscriptionDictionary.applied(to: heard, entries: dictionary)
        }
    }

    /// Puts the take's audio where the transcriber can read it.
    ///
    /// The write ticket is issued by the API and is good for this one object:
    /// it carries no provider credential, so it cannot be spent on anything but
    /// storing these bytes. The transcript still costs a credit at the route
    /// that does the transcribing.
    private static func uploadForTranscription(
        _ audio: Data,
        baseURL: URL
    ) async throws -> String {
        var ticketRequest = await YapperAPI.authenticatedRequest(
            url: baseURL.appending(path: "api/transcribe/upload-url")
        )
        ticketRequest.httpMethod = "POST"
        ticketRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        ticketRequest.httpBody = try JSONEncoder().encode(UploadTicketRequest(bytes: audio.count))
        let (ticketData, ticketResponse) = try await URLSession.shared.data(for: ticketRequest)
        guard let ticketHTTP = ticketResponse as? HTTPURLResponse else {
            throw NativeEditorError.aiFailed("The transcriber returned no response.")
        }
        guard (200 ..< 300).contains(ticketHTTP.statusCode) else {
            throw YapperAPI.failure(
                status: ticketHTTP.statusCode,
                body: ticketData,
                action: "Transcribing",
                note: EdgeRefusalNote.text(for: ticketHTTP, body: ticketData)
            )
        }
        let ticket = try JSONDecoder().decode(UploadTicket.self, from: ticketData)
        guard let uploadURL = URL(string: ticket.url) else {
            throw NativeEditorError.aiFailed("The transcriber returned an unusable upload address.")
        }

        var upload = URLRequest(url: uploadURL)
        upload.httpMethod = "PUT"
        upload.timeoutInterval = 300
        upload.setValue("audio/mp4", forHTTPHeaderField: "Content-Type")
        let (_, uploadResponse) = try await URLSession.shared.upload(for: upload, from: audio)
        guard
            let uploadHTTP = uploadResponse as? HTTPURLResponse,
            (200 ..< 300).contains(uploadHTTP.statusCode)
        else {
            throw NativeEditorError.aiFailed("The take's audio could not be uploaded for transcription.")
        }
        return ticket.key
    }

    /// Asks for the transcript of audio already in storage. The request is a
    /// few dozen bytes however long the take is.
    private static func transcribeStored(
        key: String,
        keyterms: [String],
        baseURL: URL
    ) async throws -> [RemoteWord] {
        var lastError: Error?
        for attempt in 0 ..< UploadRetrySchedule.attempts {
            try Task.checkCancellation()
            do {
                var request = await YapperAPI.authenticatedRequest(
                    url: transcribeURL(baseURL: baseURL, keyterms: keyterms)
                )
                request.httpMethod = "POST"
                request.timeoutInterval = 300
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = try JSONEncoder().encode(StoredTranscriptionRequest(key: key))
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse else {
                    throw NativeEditorError.aiFailed("The transcriber returned no response.")
                }
                guard (200 ..< 300).contains(http.statusCode) else {
                    // The audio is discarded by the route on any outcome, so a
                    // retry would be asking about something that is gone.
                    throw YapperAPI.failure(
                        status: http.statusCode,
                        body: data,
                        action: "Transcribing",
                        note: EdgeRefusalNote.text(for: http, body: data)
                    )
                }
                return try JSONDecoder().decode(TranscriptionResponse.self, from: data).words ?? []
            } catch let error as CancellationError {
                throw error
            } catch {
                lastError = error
                break
            }
        }
        throw lastError ?? NativeEditorError.aiFailed("The take could not be transcribed.")
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
        // Two model passes over a whole take's transcript. The default minute
        // gave up on a fifteen minute recording long before the server did.
        request.timeoutInterval = 300
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            CleanRequest(words: words.map { .init(text: $0.text, start: $0.start, end: $0.end) })
        )
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw NativeEditorError.aiFailed("The AI service returned no response.")
        }
        if http.statusCode == 501 {
            return locallyFinished(deterministicRetakeCuts(words), words: words)
        }
        guard (200 ..< 300).contains(http.statusCode) else {
            // Through the one place that knows what a status means to a
            // creator. "HTTP 402" told them nothing: a subscription problem and
            // an empty credit balance are different problems with different
            // fixes, and the body says which one it is.
            throw YapperAPI.failure(
                status: http.statusCode,
                body: data,
                action: "The AI edit",
                note: EdgeRefusalNote.text(for: http, body: data)
            )
        }
        let decoded = try JSONDecoder().decode(CleanResponse.self, from: data)
        let cuts = (decoded.cuts ?? []).compactMap { pair -> (Int, Int)? in
            guard pair.count == 2, words.indices.contains(pair[0]), words.indices.contains(pair[1]) else {
                return nil
            }
            return (pair[0], pair[1])
        }
        // No cuts is an answer, not a failure: a take the speaker got right in
        // one has no retakes to remove. This used to fall back to matching text
        // locally, which meant a model that answered with nothing — measured in
        // production, an overloaded provider returning an empty completion
        // inside a 200 — produced a guessed edit presented as the model's, with
        // nothing to tell a creator it had happened. The route refuses an empty
        // answer now, and this trusts the one it gets.
        // Straight through. The cleaner answers in word indices now, so these
        // are the boundaries it chose rather than the closest text match to a
        // script it wrote; there is no off-by-one to mend. The pass that used
        // to mend it read a word abutting the kept take as a clipped lead-in
        // and glued the tail of an abandoned attempt onto the front: "and go
        // to practice celpip.ca and click words."
        return EditFinishing.aiCuts(cuts, words: words)
    }

    /// The no-provider path: text matching chose these, so every finishing pass
    /// gets a say, including the two that can put words back.
    private func locallyFinished(_ cuts: [(Int, Int)], words: [TranscriptWord]) -> [(Int, Int)] {
        EditFinishing.cuts(
            RetakeCutBoundaryRepair.repaired(words: words, cuts: cuts),
            words: words
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
    ) throws -> [(Double, Double)] {
        try Task.checkCancellation()
        var ranges = aiCuts.map { (words[$0.0].start, words[$0.1].end) }
        // Sparing every word, because none have been cut yet and the words
        // between two cuts are exactly the ones a creator kept. Joining here
        // without that swallowed them, and a word swallowed here is worse than
        // one swallowed later: it is missing from `kept` below, so the silence
        // pass never learns to protect it either.
        let retakeRanges = merge(ranges, sparing: words.map(\.midpoint))
        let kept = words.filter { word in
            !retakeRanges.contains { word.midpoint >= $0.0 && word.midpoint <= $0.1 }
        }
        guard !kept.isEmpty else { return retakeRanges }

        // Measured silence, which finds the dead air a transcript hides: a
        // word's end is where it stops being a word, not where the room goes
        // quiet, and a second of flat waveform routinely reads as a 0.2s gap.
        let spoken = kept.map { ($0.start, $0.end) }
        let envelope = envelope(for: url)
        let measured = envelope.map { MeasuredSilence.ranges(envelope: $0, words: spoken) }

        if let measured, !measured.isEmpty {
            ranges.append(contentsOf: measured)
        }

        // A waveform can tell quiet from sound; it cannot tell the kept take
        // from an abandoned one the transcriber did not write down. Treating
        // measured silence as a replacement for transcript gaps therefore
        // left loud, untranscribed retakes in the finished video. They also
        // could never have captions, because there were no words to build a
        // card from. The two signals are complementary: measured ranges remove
        // dead air hidden inside generous word timings, while these ranges
        // guarantee that every surviving spoken stretch is backed by the
        // transcript and can be captioned.
        ranges.append(contentsOf: wordGapSilences(
            words: kept,
            duration: duration,
            minimumPause: 0.20
        ))
        let fillers = Set(["um", "umm", "uh", "uhh", "uhm", "er", "err", "ah", "ahh", "hmm", "mhm"])
        for word in kept where fillers.contains(normalize(word.text)) {
            ranges.append((word.start, word.end))
        }
        // `wordGapSilences` also handles both source edges.
        return merge(ranges, sparing: kept.map(\.midpoint))
    }

    /// The silence-only pass, for the Auto-trim button.
    func silenceRanges(
        words: [TranscriptWord],
        duration: Double,
        minimumPause: Double = 0.20,
        url: URL? = nil
    ) throws -> [(Double, Double)] {
        try Task.checkCancellation()
        let envelope = envelope(for: url)
        if let envelope, !envelope.loudness.isEmpty {
            var ranges = MeasuredSilence.ranges(
                envelope: envelope,
                words: words.map { ($0.start, $0.end) }
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
        return merge(ranges, sparing: ordered.map(\.midpoint))
    }

    private func decodeAudio(
        url: URL,
        output: URL,
        progress: (@MainActor @Sendable (Double) -> Void)?
    ) async throws -> DecodedAudio {
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

        let handle = try FileHandle(forWritingTo: output)
        var accumulator = LoudnessEnvelope.Accumulator(
            sampleRate: Int(format.sampleRate.rounded())
        )
        var byteCount = 0
        var lastProgress = 0.0
        defer { try? handle.close() }
        while file.framePosition < file.length {
            try Task.checkCancellation()
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
            accumulator.append(mono)
            let bytes = mono.withUnsafeBytes { Data($0) }
            try handle.write(contentsOf: bytes)
            byteCount += bytes.count
            let fraction = 0.35 * Double(file.framePosition) / Double(max(1, file.length))
            if fraction - lastProgress >= 0.01 {
                lastProgress = fraction
                await progress?(fraction)
            }
        }
        envelopes[url] = accumulator.finished()
        guard byteCount > 0 else {
            throw NativeEditorError.aiFailed("Audio decoding returned no samples.")
        }
        return DecodedAudio(url: output, byteCount: byteCount, sampleRate: Int(format.sampleRate.rounded()))
    }

    private struct NonRetryableFailure: Error { let error: Error }

    static func isRetryableTranscriptionStatus(_ status: Int) -> Bool {
        status == 0 || status == 408 || status == 429 ||
            ((500 ... 599).contains(status) && status != 501)
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

    /// Joins cuts that all but touch, so the edit is not littered with
    /// splices a frame apart.
    ///
    /// - Parameter sparing: moments that must survive. Closing a gap of a few
    ///   hundredths of a second is usually tidying, but a short word is a few
    ///   hundredths of a second long: "and", "I", "two". Measured on a real
    ///   edit, this quietly swallowed a hundred spoken words, and each one it
    ///   took left the sentence around it half said.
    private func merge(
        _ ranges: [(Double, Double)],
        sparing moments: [Double] = []
    ) -> [(Double, Double)] {
        let sorted = ranges.filter { $0.1 > $0.0 }.sorted { $0.0 < $1.0 }
        guard var current = sorted.first else { return [] }
        var result: [(Double, Double)] = []
        for range in sorted.dropFirst() {
            if range.0 <= current.1 {
                current.1 = max(current.1, range.1)
                continue
            }
            let holdsAWord = moments.contains { $0 > current.1 && $0 < range.0 }
            if range.0 <= current.1 + 0.06, !holdsAWord {
                current.1 = max(current.1, range.1)
            } else {
                result.append(current)
                current = range
            }
        }
        result.append(current)
        return result
    }

    private func normalize(_ text: String) -> String {
        text.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" }
    }

    /// One chunk of the decoded take, compressed for the wire.
    ///
    /// Raw PCM runs about 96 kB a second, so a five minute take was thirty
    /// megabytes and a dozen separate requests. The transcript route bills and
    /// rate limits by the request, so those eleven extra requests cost eleven
    /// credits and ran the account out of transcriptions halfway through a
    /// video. The same speech as AAC is around six kilobytes a second.
    private static func compressedChunk(
        at url: URL,
        start: Int,
        length: Int,
        sampleRate: Int
    ) throws -> Data {
        try Task.checkCancellation()
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        try handle.seek(toOffset: UInt64(start))
        let pcm = try handle.read(upToCount: length) ?? Data()
        guard pcm.count == length else { throw NativeEditorError.aiFailed("Decoded audio ended unexpectedly.") }
        return try TranscriptionAudioEncoder.m4a(pcm: pcm, sampleRate: sampleRate)
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
