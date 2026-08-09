import Foundation

/// Asks the backend which stretch of speech each named file belongs over, and
/// roughly where on the frame it should sit.
///
/// Only the transcript's text, the shapes involved and a handful of face
/// rectangles go over the wire. No frame is ever uploaded: the faces are found
/// on this machine by `FaceDetectionService`, and the word timings, the media
/// and the timeline never leave it either. What comes back is quotes and a
/// proposed box, and the app alone decides what seconds and what pixels those
/// mean.
actor OverlayPlacementService {
    struct File: Encodable, Sendable {
        let name: String
        /// `video` or `image`, which is all the model needs to know.
        let kind: String
        let duration: Double
        /// Width over height. Needed for the model to tell a wide card, which
        /// can sit above a face, from a tall one, which cannot.
        let aspect: Double
    }

    /// Where the speaker is at one moment, as fractions of the frame.
    struct Speaker: Encodable, Sendable {
        let at: Double
        let x: Double
        let y: Double
        let width: Double
        let height: Double

        init(_ sample: SpeakerSample) {
            at = (sample.at * 10).rounded() / 10
            x = (sample.rect.minX * 100).rounded() / 100
            y = (sample.rect.minY * 100).rounded() / 100
            width = (sample.rect.width * 100).rounded() / 100
            height = (sample.rect.height * 100).rounded() / 100
        }
    }

    /// One shipped effect, offered to the model so it can only ask for a sound
    /// that exists.
    struct Effect: Encodable, Sendable {
        let id: String
        let name: String
        let detail: String

        init(_ effect: SoundEffectDescriptor) {
            id = effect.id
            name = effect.name
            detail = effect.detail
        }
    }

    /// What comes back: media over words, sounds that belong to no media, and
    /// words to draw over the video.
    struct Plan: Sendable {
        let placements: [OverlayPlacement]
        let sounds: [SoundRequest]
        let texts: [TextRequest]
    }

    /// A cutaway that is already on the timeline.
    ///
    /// Sent so a sentence about "the overlays we have" is about something the
    /// model can see. Without it, that read as a request to place them, and it
    /// placed every one of them a second time.
    struct Placed: Encodable, Sendable {
        let name: String
        let at: Double

        init(name: String, at: Double) {
            self.name = name
            self.at = (at * 10).rounded() / 10
        }
    }

    private struct Request: Encodable {
        struct Word: Encodable { let text: String }
        let instruction: String
        let words: [Word]
        let files: [File]
        /// Width over height of the finished video.
        let frameAspect: Double
        let speaker: [Speaker]
        let effects: [Effect]
        let placed: [Placed]
    }

    private struct Reply: Decodable {
        /// The route has already thrown away anything that is not a fraction,
        /// but this is still a model's arithmetic arriving over a wire, so it
        /// goes through `OverlayPlan.proposedBox` again on the way in.
        struct Box: Decodable {
            let x: Double?
            let y: Double?
            let width: Double?
        }

        struct Placement: Decodable {
            let file: String?
            let quote: String?
            let reason: String?
            let box: Box?
            let cue: String?
            let group: String?
            let sound: String?
        }

        struct Sound: Decodable {
            let effect: String?
            let quote: String?
            let cue: String?
            let every: String?
            let at: Double?
        }

        struct Text: Decodable {
            let text: String?
            let quote: String?
            let cue: String?
            let until: String?
        }

        let placements: [Placement]?
        let sounds: [Sound]?
        let texts: [Text]?
        let error: String?
    }

    /// The library the model may choose from, in the app's own order.
    private var catalogue: [Effect] { SoundEffectDescriptor.library.map(Effect.init) }

    func plan(
        instruction: String,
        words: [String],
        files: [File],
        frameAspect: Double,
        speaker: [SpeakerSample],
        placed: [Placed] = []
    ) async throws -> Plan {
        guard !words.isEmpty else {
            throw NativeEditorError.aiFailed("Transcribe the video before placing overlays.")
        }

        var request = await YapperAPI.authenticatedRequest(
            url: YapperAPI.url(path: "api/place-overlays")
        )
        request.httpMethod = "POST"
        request.timeoutInterval = 90
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            Request(
                instruction: instruction,
                words: words.map { .init(text: $0) },
                files: files,
                frameAspect: frameAspect,
                speaker: speaker.map(Speaker.init),
                effects: catalogue,
                placed: placed
            )
        )

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw NativeEditorError.aiFailed("The AI editor returned no response.")
        }
        guard (200 ..< 300).contains(http.statusCode) else {
            throw YapperAPI.failure(
                status: http.statusCode,
                body: data,
                action: "Placing overlays"
            )
        }

        let reply = try JSONDecoder().decode(Reply.self, from: data)
        if
            let error = reply.error,
            reply.placements == nil,
            reply.sounds == nil,
            reply.texts == nil
        {
            throw NativeEditorError.aiFailed("The AI editor failed: \(error)")
        }

        let placements = (reply.placements ?? []).compactMap { placement -> OverlayPlacement? in
            guard let file = placement.file, let quote = placement.quote else { return nil }
            return OverlayPlacement(
                file: file,
                quote: quote,
                reason: placement.reason,
                // A box the model left out, or answered with nonsense, is not a
                // reason to lose the placement: the words are the hard part, and
                // a missing box just means the solver starts from the default card.
                box: OverlayPlan.proposedBox(
                    x: placement.box?.x,
                    y: placement.box?.y,
                    width: placement.box?.width
                ),
                cue: placement.cue,
                group: placement.group,
                sound: placement.sound
            )
        }
        let sounds = (reply.sounds ?? []).compactMap { sound -> SoundRequest? in
            guard let effect = sound.effect else { return nil }
            return SoundRequest(
                effect: effect,
                quote: sound.quote,
                cue: sound.cue,
                every: sound.every,
                at: sound.at
            )
        }
        let texts = (reply.texts ?? []).compactMap { text -> TextRequest? in
            guard let body = text.text, let quote = text.quote else { return nil }
            return TextRequest(text: body, quote: quote, cue: text.cue, until: text.until)
        }
        return Plan(placements: placements, sounds: sounds, texts: texts)
    }
}
