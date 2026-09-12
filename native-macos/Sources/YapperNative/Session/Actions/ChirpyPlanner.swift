import Foundation

@MainActor
extension EditorSession {
    /// Snapshot the app's state and discover actions from the same registry
    /// used by controls. File paths and credentials never enter model context.
    func chirpyContext() async throws -> [String: ActionJSON] {
        var revealOverlays: [ActionJSON] = []
        for overlay in overlays where media(for: overlay)?.generated?.revealSourceMediaID != nil {
            guard let media = media(for: overlay) else { continue }
            let regions = try await revealRegions(for: media)
            revealOverlays.append(.object([
                "overlayID": .string(overlay.id.uuidString), "name": .string(media.name),
                "regions": try .encoding(regions)
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
            "media": .array(project.media.map { .object(["id": .string($0.id.uuidString), "name": .string($0.name),
                "kind": .string($0.isScene ? "scene" : $0.isImage ? "image" : "video")]) }),
            "selectedOverlayImage": overlayVisualReference(),
            "overlays": try .encoding(overlays), "reveals": .array(revealOverlays),
            "revealEvents": try .encoding(try await revealEvents()),
            "sounds": .array((project.audioLayers ?? []).map { .object(["id": .string($0.id.uuidString),
                "name": .string($0.name), "time": .number($0.timelineStart), "effectID": $0.builtInID.map(ActionJSON.string) ?? .null]) }),
            "soundLibrary": .array(SoundEffectDescriptor.library.map { .object(["id": .string($0.id), "name": .string($0.name)]) }),
            "recentResults": try .encoding(conversation.results.suffix(16)),
            "activeOperation": .bool(activeOperation != nil)
        ]
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
                "catalog": try .encoding(appActions.descriptors),
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
