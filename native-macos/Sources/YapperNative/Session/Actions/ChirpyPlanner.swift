import Foundation

@MainActor
extension EditorSession {
    /// Snapshot the app's state and discover actions from the same registry
    /// used by controls. File paths and credentials never enter model context.
    func chirpyContext() async throws -> [String: ActionJSON] {
        var maskOverlays: [ActionJSON] = []
        for overlay in overlays where media(for: overlay)?.generated?.revealSourceMediaID != nil {
            guard let media = media(for: overlay) else { continue }
            let regions = try await revealRegions(for: media)
            maskOverlays.append(.object([
                "overlayID": .string(overlay.id.uuidString), "name": .string(media.name),
                "regions": .array(try regions.filter(\.hasMask).map { region in
                    .object(["id": .string(region.id), "label": .string(region.label),
                        "rect": try .encoding(ActionRect(x: region.box.minX, y: region.box.minY, width: region.box.width, height: region.box.height)),
                        "red": .number(region.background.red), "green": .number(region.background.green), "blue": .number(region.background.blue),
                        "opacityKeys": try .encoding(region.opacityKeys), "sourceCueTime": try .encoding(region.cueTime)])
                })
            ]))
        }
        let selectedClips = timelineSelection.compactMap { item -> UUID? in
            if case let .clip(id) = item { return id }; return nil
        }
        return [
            "projectID": .string(project.id.uuidString), "sessionID": .string(actionSessionID.uuidString),
            "revision": .number(Double(actionRevision)), "name": .string(project.name),
            "playhead": .number(currentTime), "duration": .number(duration),
            "selectedClipIDs": try .encoding(selectedClips), "selectedCaptionIDs": try .encoding(Array(selectedCaptionIDs)),
            "selectedOverlayIDs": try .encoding(Array(selectedOverlayIDs)),
            "selectedOverlayID": selectedOverlayID.map { .string($0.uuidString) } ?? .null,
            "clips": try .encoding(project.clips),
            "captionsVisible": .bool(project.captionsEnabled == true),
            "captionStyle": try .encoding(project.captionStyleOrDefault),
            "textLayers": try .encoding(project.textLayers ?? []),
            "backdrop": .string(project.resolvedBackdrop.hex),
            "aspectRatio": .string(project.selectedAspectRatio.rawValue),
            "visualFilter": try .encoding(project.resolvedVisualFilter),
            "videoTrackHidden": .bool(project.isVideoTrackHidden), "videoTrackMuted": .bool(project.isVideoTrackMuted),
            "canUndo": .bool(canUndo), "canRedo": .bool(canRedo),
            "videoTrackVolume": .number(project.resolvedVideoTrackVolume),
            "speechAvailable": .bool(!TimelineCue.words(in: project).isEmpty),
            "media": .array(project.media.map { media in .object(["id": .string(media.id.uuidString), "name": .string(media.name),
                "duration": .number(media.duration), "width": .number(Double(media.width)), "height": .number(Double(media.height)),
                "kind": .string(media.isScene ? "scene" : media.isImage ? "image" : "video"),
                "onMainTrack": .bool(project.clips.contains { $0.mediaID == media.id }),
                "usedAsOverlay": .bool((project.overlays ?? []).contains { $0.mediaID == media.id })]) }),
            "selectedOverlayImage": await overlayVisualReference(),
            "overlays": try .encoding(overlays), "masks": .array(maskOverlays),
            "animationEvents": try .encoding(try await animationEvents()),
            "sounds": .array((project.audioLayers ?? []).map { .object(["id": .string($0.id.uuidString),
                "name": .string($0.name), "time": .number($0.timelineStart), "volume": .number($0.volume),
                "duration": .number($0.duration), "sourceStart": .number($0.sourceStart),
                "sourceDuration": .number($0.sourceDuration ?? $0.sourceEnd), "playbackRate": .number($0.resolvedPlaybackRate),
                "effectID": $0.builtInID.map(ActionJSON.string) ?? .null]) }),
            "savedAudioLibrary": .array(AudioLibraryStore.shared.items.filter { AudioLibraryStore.shared.ownsAvailable($0) }.prefix(500).map {
                .object(["id": .string($0.id.uuidString), "name": .string($0.name), "duration": .number($0.duration)])
            }),
            "soundLibrary": .array(SoundEffectDescriptor.library.map { .object(["id": .string($0.id), "name": .string($0.name)]) }),
            "timelineItems": .array(try timelineItemsForContext()),
            "transcript": .array(project.chirpyTranscript()),
            "recentResults": try .encoding(conversation.results.suffix(16)),
            "activeOperation": .bool(activeOperation != nil)
        ]
    }

    /// Every item on the timeline with its kind and timeline span, in play
    /// order, so a request like "delete the third clip" resolves to an ID.
    /// Captions appear only here: the stored cards add word ID lists the
    /// planner never needs, so only their lock and restyling come along.
    private func timelineItemsForContext() throws -> [ActionJSON] {
        var items: [(start: Double, json: ActionJSON)] = []
        for clip in project.clips {
            let start = project.timelineStart(for: clip.id) ?? 0
            items.append((start, .object(["id": .string(clip.id.uuidString), "kind": .string("clip"),
                "start": .number(start), "end": .number(start + clip.duration), "locked": .bool(clip.locked),
                "media": .string(project.media(for: clip)?.name ?? "")])))
        }
        let captions = Dictionary(project.storedCaptions.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for cue in project.captionCues {
            var item: [String: ActionJSON] = ["id": .string(cue.id.uuidString), "kind": .string("caption"),
                "start": .number(cue.timelineStart), "end": .number(cue.timelineEnd), "text": .string(String(cue.text.prefix(80)))]
            if let caption = captions[cue.id] {
                if caption.locked { item["locked"] = .bool(true) }
                if caption.hasStyleOverrides { item["styleOverrides"] = try .encoding(caption.overrides) }
            }
            items.append((cue.timelineStart, .object(item)))
        }
        for layer in project.textLayers ?? [] {
            items.append((layer.timelineStart, .object(["id": .string(layer.id.uuidString), "kind": .string("text"),
                "start": .number(layer.timelineStart), "end": .number(layer.timelineStart + layer.duration), "text": .string(String(layer.text.prefix(80)))])))
        }
        for overlay in overlays {
            items.append((overlay.timelineStart, .object(["id": .string(overlay.id.uuidString), "kind": .string("overlay"),
                "start": .number(overlay.timelineStart), "end": .number(overlay.timelineStart + overlay.duration), "media": .string(media(for: overlay)?.name ?? "")])))
        }
        for layer in project.audioLayers ?? [] {
            items.append((layer.timelineStart, .object(["id": .string(layer.id.uuidString), "kind": .string("sound"),
                "start": .number(layer.timelineStart), "end": .number(layer.timelineStart + layer.duration), "name": .string(layer.name)])))
        }
        return items.sorted { $0.start < $1.start }.prefix(2000).map(\.json)
    }

    func runContextualAssistant(_ text: String) async {
        conversation.attach(projectID: project.id, root: projectNavigation.currentPackage?.url)
        conversation.ask(text)
        guard activeOperation == nil else {
            conversation.answer(.chirpy("Wait for the current operation to finish before asking for another edit.", tone: .trouble)); return
        }
        let projectID = project.id, revision = actionRevision, executionID = UUID()
        do {
            try Task.checkCancellation()
            let context = try await chirpyContext()
            try Task.checkCancellation()
            guard project.id == projectID, actionRevision == revision else {
                throw AppActionError("The project changed while I was reading it. Ask again using its current state.")
            }
            let payload: [String: ActionJSON] = [
                "protocolVersion": .number(1), "executionID": .string(executionID.uuidString),
                "projectID": .string(projectID.uuidString), "sessionID": .string(actionSessionID.uuidString),
                "revision": .number(Double(revision)), "context": .object(context),
                "catalog": try .encoding(appActions.planningDescriptors),
                "messages": .array(conversation.messages.map { .object([
                    "role": .string($0.author == .you ? "user" : "assistant"),
                    "content": .string(($0.text + ($0.notes.isEmpty ? "" : "\n" + $0.notes.joined(separator: "\n"))).prefixString(6000))
                ]) })
            ]
            setStatus("Chirpy is reading the current edit…")
            let reply = try await (chirpyPlanner ?? ChirpyPlanningService.plan)(payload)
            try ActionSchema.validate(try .encoding(reply), against: ActionSchema.definition("ChirpyPlanReply"))
            try Task.checkCancellation()
            guard project.id == projectID, actionRevision == revision else {
                throw AppActionError("The project changed while I was planning. Ask again using its current state.")
            }
            guard !reply.actions.isEmpty else {
                conversation.answer(.chirpy(reply.message)); return
            }
            try conversation.begin(executionID)
            let receipts = await appActions.executeBatch(reply.actions, projectID: projectID, revision: revision, in: self)
            try conversation.finish(receipts, invocationID: executionID)
            let succeeded = receipts.allSatisfy { $0.status == .applied || $0.status == .unchanged }
            // Only execution receipts can announce success. A model's planned
            // changes are never presented as changes that actually happened.
            conversation.answer(.chirpy(succeeded ? "\(receipts.map(\.message).joined(separator: " "))" : "I couldn’t complete that edit.",
                notes: succeeded ? [] : receipts.map(\.message), tone: succeeded ? .done : .trouble))
        } catch {
            if project.id == projectID {
                conversation.answer(.chirpy((error is CancellationError || Task.isCancelled) ? "Request canceled." : error.localizedDescription, tone: .trouble))
            }
        }
    }
}

private extension String {
    func prefixString(_ count: Int) -> String { String(prefix(count)) }
}

enum ChirpyPlanningService {
    static func plan(_ body: [String: ActionJSON]) async throws -> ChirpyPlanReply {
        var request = await YapperAPI.authenticatedRequest(url: YapperAPI.url(path: "api/chirpy/plan"))
        request.httpMethod = "POST"
        request.timeoutInterval = 55
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try ChirpyRequestBudget.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AppActionError("Chirpy returned no response.") }
        guard (200..<300).contains(http.statusCode) else { throw YapperAPI.failure(status: http.statusCode, body: data, action: "Planning the edit") }
        guard data.count <= 64 * 1024 else { throw AppActionError("Chirpy’s response was too large.") }
        return try JSONDecoder().decode(ChirpyPlanReply.self, from: data)
    }
}
