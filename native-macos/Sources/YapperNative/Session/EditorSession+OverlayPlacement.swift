import CoreGraphics
import Foundation

/// What the AI placement pass is doing, for the panel that started it.
enum OverlayPlacementStatus: Equatable, Sendable {
    case idle
    case working
    /// Finished, with one line per cutaway that landed.
    case placed(notes: [String])
    case generated(notes: [String], changed: Int)
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

    /// Runs the job Chirpy's planner chose, on the files it chose. Sounds on
    /// overlays already placed and volume changes never come here: those are
    /// `editor.audio.addAt` and `editor.audio.setVolume`.
    @discardableResult
    func placeOverlaysWithAI(_ request: OverlayWorkflowInput) async -> Bool {
        guard !project.clips.isEmpty else { return false }
        return await runTrackedLongOperation(.overlayAI) { [weak self] _ in
            await self?.performOverlayWorkflow(request)
        }
    }

    private func performOverlayWorkflow(_ request: OverlayWorkflowInput) async {
        guard !Task.isCancelled else {
            markCurrentLongOperationCanceled()
            setOverlayPlacement(.idle)
            setStatus("Overlay placement canceled")
            return
        }
        clearError()

        let target: OverlayWorkflowTarget
        do {
            target = try overlayWorkflowTarget(for: request)
        } catch {
            setOverlayPlacement(.failed(error.localizedDescription))
            return
        }

        if placeableWords.isEmpty {
            guard let rollbackState = await beginPreparedTimelineEdit() else { return }
            defer { endPreparedTimelineEdit() }
            do {
                try await transcribeMissingProjectMediaWithinOperation()
                try Task.checkCancellation()
                try await persist()
                recordHistory(before: rollbackState.project)
            } catch is CancellationError {
                markCurrentLongOperationCanceled()
                await restoreCanceledEditState(
                    rollbackState,
                    rebuildPlayer: false,
                    status: "Overlay placement canceled"
                )
                setOverlayPlacement(.idle)
                return
            } catch {
                await restoreEditState(rollbackState, rebuildPlayer: false, preserving: error)
                setOverlayPlacement(.failed(error.localizedDescription))
                return
            }
            guard !placeableWords.isEmpty else {
                setOverlayPlacement(.failed("This video has no transcript to place overlays against."))
                return
            }
        }

        switch target {
        case let .place(files):
            await placeImported(files, instruction: request.instruction)
        case .create:
            await performGeneratedOverlays(instruction: request.instruction, revising: [])
        case let .revise(scenes):
            await performGeneratedOverlays(instruction: request.instruction, revising: scenes)
        case let .revealNumbers(source):
            await performImageNumberReveal(instruction: request.instruction, source: source)
        }
    }

    private func placeImported(_ files: [ProjectMedia], instruction: String) async {
        setOverlayPlacement(.working)
        guard let rollbackState = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }

        do {
            // Found before the model is asked, not after: it can only choose a
            // box that clears the speaker if it knows where the speaker is.
            setStatus("Looking at where you are in frame…")
            let speaker = await speakerTrack()
            try Task.checkCancellation()

            setStatus("Deciding where each overlay belongs…")
            let words = placeableWords
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
            // Each span is looked at again, closely, before its box is settled.
            // That is more frames to decode, so say so rather than sit silent.
            if !spans.isEmpty { setStatus("Fitting each overlay around you…") }
            let placed = await applyPlacedSpans(spans, words: words, files: files)
            try Task.checkCancellation()
            let textNotes = applyPlacedTexts(texts, words: words)

            addSounds(placed.sounds + standalone.sounds)
            let notes = placed.notes + textNotes + soundNotes(standalone.sounds)
            guard !notes.isEmpty else {
                setOverlayPlacement(.failed(placed.skippedExisting > 0 && standalone.unknown.isEmpty
                    ? "Those overlays are already at those moments. No duplicate copies were added."
                    : nothingLanded(unknownEffects: standalone.unknown)))
                setStatus("Ready")
                return
            }
            try Task.checkCancellation()
            let success = await commitPreparedTimelineEdit(
                rollbackState: rollbackState,
                successStatus: "Placed \(notes.count) change\(notes.count == 1 ? "" : "s") · ⌘Z to undo"
            )
            guard success else {
                setOverlayPlacement(.failed(errorMessage ?? "The edit could not be saved."))
                return
            }
            setOverlayPlacement(.placed(notes: notes + unknownNotes(standalone.unknown)))
        } catch is CancellationError {
            markCurrentLongOperationCanceled()
            await restoreCanceledEditState(
                rollbackState,
                rebuildPlayer: true,
                status: "Overlay placement canceled"
            )
            setOverlayPlacement(.idle)
        } catch {
            await restoreEditState(rollbackState, rebuildPlayer: true, preserving: error)
            setOverlayPlacement(
                .failed((error as? LocalizedError)?.errorDescription ?? error.localizedDescription)
            )
            setStatus("Needs attention")
        }
    }

    /// What the pass has to say when it changed nothing at all.
    func nothingLanded(unknownEffects: [String]) -> String {
        guard unknownEffects.isEmpty else {
            let names = unknownEffects.map { "“\($0)”" }.joined(separator: ", ")
            return "There is no \(names) in the sound library."
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
