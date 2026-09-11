import Foundation

extension AppActionRegistry {
    static func editor() -> AppActionRegistry {
        let registry = AppActionRegistry()
        registry.registerClipSpeed()
        registry.registerTimelineLock()
        registry.registerCaptionVisibility()
        registry.registerRevealActions()
        registry.registerWorkflow(TranscribeWorkflowInput.self) { session, _ in
            await session.transcribeProject(); return session.lastTranscriptionWasCanceled
        }
        registry.registerWorkflow(CleanupWorkflowInput.self) { session, _ in await session.runOneClickEdit() }
        registry.registerWorkflow(SilenceWorkflowInput.self) { session, _ in await session.autoTrimSilences() }
        registry.registerWorkflow(OverlayWorkflowInput.self) { session, input in
            let canceled = await session.placeOverlaysWithAI(instruction: input.instruction)
            if case let .failed(message) = session.overlayPlacement { throw AppActionError(message) }
            return canceled
        }
        return registry
    }

    private func registerClipSpeed() {
        register(ClipSpeedInput.self, availability: { session in
            session.project.clips.contains { !($0.locked) && session.project.media(for: $0)?.isImage == false }
                ? .available : .init(reason: "Select an unlocked video clip to change speed.")
        }) { session, input in
            let targets = Set(input.clipIDs)
            guard targets.isSubset(of: Set(session.project.clips.map(\.id))) else {
                throw AppActionError("A requested clip no longer exists.")
            }
            let before = session.project
            var changes: [AppActionChange] = []
            var skipped: [UUID] = []
            var newTime = session.currentTime
            session.updateProject { project in
                for index in project.clips.indices where targets.contains(project.clips[index].id) {
                    let clip = project.clips[index]
                    if clip.locked || project.media(for: clip)?.isImage != false { skipped.append(clip.id); continue }
                    guard clip.resolvedPlaybackRate != input.rate else { continue }
                    project.clips[index].playbackRate = input.rate == 1 ? nil : input.rate
                    changes.append(.init(targetID: clip.id, property: "playbackRate",
                                         before: String(clip.resolvedPlaybackRate), after: String(input.rate)))
                }
                guard !changes.isEmpty else { return }
                let timing = ClipSpeedTimeMap(before: before.clips, after: project.clips)
                newTime = timing.map(session.currentTime)
                for index in project.overlays?.indices ?? 0..<0 {
                    project.overlays?[index].timelineStart = timing.map(before.overlays![index].timelineStart)
                }
                for index in project.audioLayers?.indices ?? 0..<0 {
                    project.audioLayers?[index].timelineStart = timing.map(before.audioLayers![index].timelineStart)
                }
                for index in project.textLayers?.indices ?? 0..<0 {
                    let original = before.textLayers![index]
                    let start = timing.map(original.timelineStart)
                    project.textLayers?[index].timelineStart = start
                    project.textLayers?[index].duration = timing.map(original.timelineStart + original.duration) - start
                }
            }
            let count = changes.count
            let message = count == 0
                ? (skipped.isEmpty ? "Selected clips already have that speed." : "No speed changed; locked or still-image clips were skipped.")
                : "Speed \(ClipSpeed.label(input.rate)) · \(count) clip\(count == 1 ? "" : "s") · voice pitch preserved"
                    + (skipped.isEmpty ? "" : " · \(skipped.count) locked skipped")
            return AppActionMutation(message: message, changes: changes, skippedIDs: skipped,
                                     afterCommit: { session.seekToTimelineTime(newTime) })
        }
    }

    private func registerTimelineLock() {
        register(TimelineLockInput.self, availability: { session in
            session.project.clips.isEmpty && session.project.storedCaptions.isEmpty
                ? .init(reason: "There are no clips or captions to lock.") : .available
        }) { session, input in
            let clips = Set(input.clipIDs), captions = Set(input.captionIDs)
            guard !clips.isEmpty || !captions.isEmpty else { throw AppActionError("Select clips or captions first.") }
            guard clips.isSubset(of: Set(session.project.clips.map(\.id))),
                  captions.isSubset(of: Set(session.project.storedCaptions.map(\.id))) else {
                throw AppActionError("A requested clip or caption no longer exists.")
            }
            let items = Set(clips.map(TimelineSelectionItem.clip) + captions.map(TimelineSelectionItem.caption))
            let changes = items.compactMap { item -> AppActionChange? in
                let wasLocked = session.isLocked(item)
                guard wasLocked != input.locked else { return nil }
                let id: UUID
                switch item { case .clip(let value), .caption(let value): id = value; default: return nil }
                return .init(targetID: id, property: "locked", before: String(wasLocked), after: String(input.locked))
            }.sorted { $0.targetID.uuidString < $1.targetID.uuidString }
            if !changes.isEmpty { session.updateProject { $0.setLocked(input.locked, items: items) } }
            return AppActionMutation(message: changes.isEmpty ? "The selection already has that lock setting."
                : (input.locked ? "Selection locked" : "Selection unlocked"), changes: changes)
        }
    }

    private func registerCaptionVisibility() {
        register(CaptionVisibilityInput.self, operation: .captions, availability: { session in
            session.project.clips.isEmpty ? .init(reason: "Add video before showing captions.") : .available
        }) { session, input in
            let before = session.project.captionsEnabled == true
            guard before != input.visible else { return AppActionMutation(message: input.visible ? "Captions are already showing." : "Captions are already hidden.") }
            let message = try await session.mutateCaptionVisibility(input.visible)
            return AppActionMutation(message: message, changes: [.init(targetID: session.project.id,
                property: "captionsVisible", before: String(before), after: String(input.visible))])
        }
    }
}
