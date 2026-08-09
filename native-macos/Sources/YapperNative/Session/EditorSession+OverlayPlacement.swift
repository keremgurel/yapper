import CoreGraphics
import Foundation

/// What the AI placement pass is doing, for the panel that started it.
enum OverlayPlacementStatus: Equatable, Sendable {
    case idle
    case working
    /// Finished, with one line per cutaway that landed.
    case placed(notes: [String])
    case failed(String)
}

/// "Put the hook card over the part where I say what the video is about."
///
/// The model is only ever shown the words a viewer would hear and the names of
/// the media in the bin. It answers with quotes, those quotes are matched back
/// against the transcript here, and only what the transcript backs is turned
/// into an overlay. Nothing it invents can reach the timeline.
@MainActor
extension EditorSession {
    /// The words that survive the current edit, in the order they are heard.
    ///
    /// A transcript keeps every take, including the ones that have since been
    /// cut. Offering those to the model is how a cutaway ends up quoted from a
    /// sentence that is no longer in the video.
    var placeableWords: [TranscriptWord] {
        project.timelineTranscript
            .filter { project.isWordKept($0) }
            .map { ($0, project.nearestTimelineTime(for: $0)) }
            .sorted { $0.1 < $1.1 }
            .map(\.0)
    }

    /// Media the placement pass can draw on: everything in the bin that is not
    /// the footage being edited on the main track.
    var placeableMedia: [ProjectMedia] {
        let onTimeline = Set(project.clips.map(\.mediaID))
        return project.media.filter { !onTimeline.contains($0.id) }
    }

    func placeOverlaysWithAI(instruction: String) async {
        guard !project.clips.isEmpty, !isAIEditing else { return }

        // Answered here when the sentence has nothing in it to decide: which
        // sounds, and on every one of what. The model is never told what is
        // already on the timeline, so it reads "on every overlay we have" as a
        // request to place those overlays, and places them all over again.
        if let sweep = SoundSweep.parse(instruction) {
            await applySweep(sweep, instruction: instruction)
            return
        }
        // "Make all the pops 80%": which sounds, and how loud. Nothing to
        // decide, so nothing to ask.
        if let level = SoundLevelCommand.parse(instruction) {
            let notes = applyLevelCommand(level)
            setOverlayPlacement(
                notes.isEmpty
                    ? .failed(levelCommandEmptyReason(level))
                    : .placed(notes: notes)
            )
            return
        }
        // A sentence purely about sound or about words on screen has nothing to
        // do with the bin, and those are the cases that can still run with
        // nothing in it. Anything else asking for overlays with no overlays to
        // place is answered here rather than paid for and answered by the model.
        let intent = AssistantRouter.route(instruction)
        guard !placeableMedia.isEmpty || intent == .addSounds || intent == .placeText else {
            setOverlayPlacement(.failed("Import the overlays you want placed first."))
            return
        }

        if placeableWords.isEmpty {
            await transcribeProject()
            guard !placeableWords.isEmpty else {
                setOverlayPlacement(.failed("This video has no transcript to place overlays against."))
                return
            }
        }

        let named = OverlayPlan.mentionedNames(
            in: instruction,
            names: placeableMedia.map(\.name)
        )
        // Mentioning nothing means "use what I have", not "use nothing".
        let files = named.isEmpty
            ? placeableMedia
            : placeableMedia.filter { named.contains($0.name) }

        setOverlayPlacement(.working)
        setBusy(true)
        defer { setBusy(false) }

        // Found before the model is asked, not after: it can only choose a box
        // that clears the speaker if it knows where the speaker is, and which
        // moments matter is decided by the same reply this feeds.
        setStatus("Looking at where you are in frame…")
        let speaker = await speakerTrack()

        setStatus("Deciding where each overlay belongs…")
        let words = placeableWords
        do {
            let plan = try await overlayPlacementService.plan(
                instruction: instruction,
                words: words.map(\.text),
                files: files.map {
                    .init(
                        name: $0.name,
                        kind: $0.isImage ? "image" : "video",
                        duration: $0.duration,
                        aspect: CompositionBuilder.aspect(of: $0)
                    )
                },
                frameAspect: project.resolvedAspectRatio,
                speaker: speaker,
                placed: (project.overlays ?? [])
                    .filter(\.isVisible)
                    .sorted { $0.timelineStart < $1.timelineStart }
                    .compactMap { overlay in
                        project.media
                            .first { $0.id == overlay.mediaID }
                            .map { .init(name: $0.name, at: overlay.timelineStart) }
                    }
            )
            let spans = OverlayPlan.spans(
                words: words,
                placements: plan.placements,
                knownFiles: files.map(\.name)
            )
            let standalone = resolvedSounds(
                plan.sounds,
                words: words,
                instruction: instruction
            )
            let texts = TextPlan.spans(words: words, requests: plan.texts)
            let undoSnapshot = prepareUndoSnapshot()
            // Each span is looked at again, closely, before its box is settled.
            // That is more frames to decode, so say so rather than sit silent.
            if !spans.isEmpty { setStatus("Fitting each overlay around you…") }
            let placed = await applyPlacedSpans(spans, words: words, files: files)
            let textNotes = applyPlacedTexts(texts, words: words)

            addSounds(placed.sounds + standalone.sounds)
            let notes = placed.notes + textNotes + soundNotes(standalone.sounds)
            guard !notes.isEmpty else {
                setOverlayPlacement(.failed(nothingLanded(unknownEffects: standalone.unknown)))
                setStatus("Ready")
                return
            }
            await commitTimelineEdit(undoSnapshot: undoSnapshot)
            setOverlayPlacement(.placed(notes: notes + unknownNotes(standalone.unknown)))
            setStatus("Placed \(notes.count) change\(notes.count == 1 ? "" : "s") · ⌘Z to undo")
        } catch {
            setOverlayPlacement(
                .failed((error as? LocalizedError)?.errorDescription ?? error.localizedDescription)
            )
            setStatus("Needs attention")
        }
    }

    /// Places a sweep and reports it the same way the model's own pass does, so
    /// the reply reads identically whichever answered it.
    /// Awaited to the end, and only then reported.
    ///
    /// This used to commit inside a detached task and return, which left the
    /// status still saying `working` when the assistant read it a moment later
    /// — and `working` is reported as "that did not finish". The sounds landed
    /// every time; the reply said they had not.
    private func applySweep(_ sweep: SoundSweep, instruction: String) async {
        setOverlayPlacement(.working)
        let sounds = applySoundSweep(sweep, instruction: instruction)
        guard !sounds.isEmpty else {
            setOverlayPlacement(.failed(sweepEmptyReason(sweep)))
            return
        }
        let undoSnapshot = prepareUndoSnapshot()
        let before = (project.audioLayers ?? []).count
        addSounds(sounds)
        // What actually landed, not what was asked for: a sound already sitting
        // on that frame is left alone, and claiming it was added again would be
        // a lie the timeline immediately contradicts.
        let added = (project.audioLayers ?? []).count - before
        guard added > 0 else {
            setOverlayPlacement(.failed("Those moments already have a sound on them."))
            return
        }
        let notes = soundNotes(Array(sounds.suffix(added)))
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
        setOverlayPlacement(.placed(notes: notes))
        setStatus("Placed \(added) sound\(added == 1 ? "" : "s") · ⌘Z to undo")
    }

    /// What the pass has to say when it changed nothing at all.
    func nothingLanded(unknownEffects: [String]) -> String {
        guard unknownEffects.isEmpty else {
            let names = unknownEffects.map { "“\($0)”" }.joined(separator: ", ")
            return "There is no \(names) in the sound library."
        }
        guard !placeableMedia.isEmpty else {
            return "Import the overlays you want placed first."
        }
        return "Nothing in the transcript matched. Try naming the moment."
    }

    func soundNotes(_ sounds: [ResolvedSound]) -> [String] {
        sounds.map { "\($0.effect.name) · \(formatTime($0.timelineStart))" }
    }

    /// An effect nobody has is worth saying out loud. Quietly doing nothing is
    /// how a creator ends up believing the pop is there.
    func unknownNotes(_ unknown: [String]) -> [String] {
        unknown.map { "No “\($0)” in the sound library, so it was skipped" }
    }
}
