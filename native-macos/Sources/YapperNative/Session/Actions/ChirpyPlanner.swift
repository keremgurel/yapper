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
            "selectedOverlayID": selectedOverlayID.map { .string($0.uuidString) } ?? .null,
            "clips": try .encoding(project.clips), "captions": try .encoding(project.storedCaptions),
            "captionsVisible": .bool(project.captionsEnabled == true),
            "captionStyle": try .encoding(project.captionStyleOrDefault),
            "textLayers": try .encoding(project.textLayers ?? []),
            "backdrop": .string(project.resolvedBackdrop.hex),
            "videoTrackVolume": .number(project.resolvedVideoTrackVolume),
            "speechAvailable": .bool(!TimelineCue.words(in: project).isEmpty),
            "media": .array(project.media.map { .object(["id": .string($0.id.uuidString), "name": .string($0.name),
                "kind": .string($0.isScene ? "scene" : $0.isImage ? "image" : "video")]) }),
            "selectedOverlayImage": await overlayVisualReference(),
            "overlays": try .encoding(overlays), "masks": .array(maskOverlays),
            "animationEvents": try .encoding(try await animationEvents()),
            "sounds": .array((project.audioLayers ?? []).map { .object(["id": .string($0.id.uuidString),
                "name": .string($0.name), "time": .number($0.timelineStart), "volume": .number($0.volume),
                "effectID": $0.builtInID.map(ActionJSON.string) ?? .null]) }),
            "soundLibrary": .array(SoundEffectDescriptor.library.map { .object(["id": .string($0.id), "name": .string($0.name)]) }),
            "timelineItems": .array(timelineItemsForContext()),
            "transcript": .array(transcriptForContext()),
            "recentResults": try .encoding(conversation.results.suffix(16)),
            "activeOperation": .bool(activeOperation != nil)
        ]
    }

    /// Every item on the timeline with its kind and timeline span, in play
    /// order, so a request like "delete the third clip" resolves to an ID.
    private func timelineItemsForContext() -> [ActionJSON] {
        var items: [(start: Double, json: ActionJSON)] = []
        for clip in project.clips {
            let start = project.timelineStart(for: clip.id) ?? 0
            items.append((start, .object(["id": .string(clip.id.uuidString), "kind": .string("clip"),
                "start": .number(start), "end": .number(start + clip.duration), "locked": .bool(clip.locked),
                "media": .string(project.media(for: clip)?.name ?? "")])))
        }
        for cue in project.captionCues {
            items.append((cue.timelineStart, .object(["id": .string(cue.id.uuidString), "kind": .string("caption"),
                "start": .number(cue.timelineStart), "end": .number(cue.timelineEnd), "text": .string(String(cue.text.prefix(80)))])))
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

    /// The transcript with word IDs and whether each word is still in the
    /// edit, so word-level cuts and restores can name exactly what to change.
    private func transcriptForContext() -> [ActionJSON] {
        (project.transcript ?? []).prefix(4000).map { word in
            .object(["id": .string(word.id.uuidString), "text": .string(word.text), "mediaID": .string(word.mediaID.uuidString),
                     "start": .number(word.start), "end": .number(word.end), "kept": .bool(project.isWordKept(word))])
        }
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
        request.httpBody = try JSONEncoder().encode(body)
        guard request.httpBody!.count <= 512 * 1024 else { throw AppActionError("This project is too large for Chirpy’s current context limit.") }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AppActionError("Chirpy returned no response.") }
        guard (200..<300).contains(http.statusCode) else { throw YapperAPI.failure(status: http.statusCode, body: data, action: "Planning the edit") }
        guard data.count <= 64 * 1024 else { throw AppActionError("Chirpy’s response was too large.") }
        return try JSONDecoder().decode(ChirpyPlanReply.self, from: data)
    }
}
