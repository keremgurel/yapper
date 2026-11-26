import Foundation

/// The paid design or revision a generated card came from. Sent with its
/// rendered check so the server can refund the card if the check drops it.
struct GeneratedOverlayCharge: Equatable {
    let usageId: String
    let id: String

    init?(usageId: Any?, id: String) {
        guard let usageId = usageId as? String, !usageId.isEmpty else { return nil }
        self.usageId = usageId
        self.id = id
    }

    var body: [String: String] { ["usageId": usageId, "id": id] }
}

/// What the rendered check took back out, and the lines that say so.
struct GeneratedOverlayReview: Equatable {
    var notes: [String] = []
    var dropped: Set<UUID> = []
}

@MainActor
extension EditorSession {
    /// Reviews the staged composition before the existing prepared-edit
    /// transaction saves anything. Every changed visible instance is checked,
    /// including reused/moved assets and revisions appearing more than once.
    ///
    /// A card that still fails after its repairs, or cannot be checked, is
    /// taken back out on its own: a new card is removed, a revised one returns
    /// to its previous version. The other cards stay. The returned notes say
    /// what was left out, why, and what the server refunded for it.
    func verifyGeneratedChanges(since previous: EditorProject, instruction: String,
                                charges: [UUID: GeneratedOverlayCharge] = [:]) async throws -> GeneratedOverlayReview {
        let changedIDs = Set(project.media.filter { media in
            media.isScene && previous.media.first(where: { $0.id == media.id }) != media
        }.map(\.id))
        var targets = (project.overlays ?? []).filter { overlay in
            overlay.isVisible && project.media.contains { $0.id == overlay.mediaID && $0.isScene } &&
            (changedIDs.contains(overlay.mediaID) || !(previous.overlays ?? []).contains(overlay))
        }.map(\.id)
        guard !targets.isEmpty else { return GeneratedOverlayReview() }
        var dropped: [String] = []
        var droppedIDs: Set<UUID> = []
        var runRefund = 0

        func drop(_ media: ProjectMedia, issues: [String], refunded: [String: Any]?) {
            revertGeneratedChange(mediaID: media.id, to: previous)
            droppedIDs.insert(media.id)
            targets.removeAll { id in !(project.overlays ?? []).contains { $0.id == id } }
            let credits = refunded?["credits"] as? Int ?? 0
            runRefund += refunded?["run"] as? Int ?? 0
            dropped.append(OverlayWorkflowOutcome.droppedCard(name: media.name, revised: previous.media.contains { $0.id == media.id },
                                                              issues: issues, refunded: credits))
        }

        for pass in 0..<3 {
            try Task.checkCancellation()
            guard !targets.isEmpty else { break }
            setStatus(pass == 0 ? "Checking the visuals in the finished video…" : "Rendering and checking the repaired visuals…")
            let instances = (project.overlays ?? []).filter { targets.contains($0.id) }
            let start = max(0, (instances.map(\.timelineStart).min() ?? 0) - 0.15)
            let end = min(project.duration, (instances.map { $0.timelineStart + $0.duration }.max() ?? project.duration) + 0.15)
            let inspection = try await TimelineInspectionService.render(project: project, range: start...end)
            defer { inspection.discard() }
            var repairedIDs: Set<UUID> = []
            var evidenceNotes: [UUID: [String]] = [:]
            for id in targets {
                try Task.checkCancellation()
                // An earlier failure in this pass may have taken this instance
                // out with the rest of its asset.
                guard let overlay = project.overlays?.first(where: { $0.id == id }) else { continue }
                guard let media = project.media.first(where: { $0.id == overlay.mediaID }) else {
                    throw NativeEditorError.aiFailed("An overlay changed while it was being checked.")
                }
                // This instance shares a scene already repaired in this pass.
                // Its evidence still depicts the old scene; re-render first.
                if repairedIDs.contains(media.id) { continue }
                let scene = try SceneExportLayer.loadScene(for: media)
                let times = TimelineInspectionService.reviewTimes(overlay: overlay, scene: scene, projectDuration: project.duration)
                let evidence = try await inspection.inspect(times: times)
                let palette = media.generated?.palette ?? .house
                setStatus("Checking \(media.name)…")
                var body: [String: Any] = [
                    "op": "restyle", "instruction": String(instruction.prefix(1000)), "repair": pass < 2,
                    "timelineStart": overlay.timelineStart, "inspection": evidence,
                    "renderPalette": ["primary": palette.primary.hex, "secondary": palette.secondary.hex,
                                      "accent": palette.accent.hex, "ink": palette.ink.hex,
                                      "surface": palette.surface.hex, "muted": palette.muted.hex],
                    "sourceStart": overlay.sourceStart, "visibleDuration": overlay.duration,
                    "placement": ["x": overlay.x, "y": overlay.y, "width": overlay.width, "height": overlay.height],
                    "frameAspect": project.resolvedAspectRatio, "frameHeightPx": 1080,
                    "duration": scene.duration,
                    "box": ["aspect": Double(media.width) / Double(media.height), "widthPx": media.width, "heightPx": media.height],
                    "asset": ["name": media.name, "description": media.generated?.description ?? "",
                              "brief": media.generated?.brief ?? "", "quote": media.generated?.quote ?? "",
                              "scene": try JSONSerialization.jsonObject(with: scene.encoded())]]
                if let charge = charges[media.id] { body["charge"] = charge.body }
                let response: [String: Any]
                do {
                    response = try await generatedOverlayRequest("review-overlay", body)
                } catch is CancellationError {
                    throw CancellationError()
                } catch {
                    if Task.isCancelled { throw CancellationError() }
                    drop(media, issues: ["The visual check could not be completed: \(error.localizedDescription)"], refunded: nil)
                    continue
                }
                guard let passed = response["passed"] as? Bool,
                      let issues = response["issues"] as? [String], passed == issues.isEmpty else {
                    drop(media, issues: ["The visual check returned an unreadable result."], refunded: response["refunded"] as? [String: Any])
                    continue
                }
                if passed {
                    evidenceNotes[media.id, default: []].append("Composited-frame review passed at edited seconds: " + times.map { String(format: "%.2f", $0) }.joined(separator: ", ") + ". Sampled visual review, not an audio listening test.")
                    continue
                }
                guard pass < 2, let repair = response["repaired"] as? [String: Any] else {
                    drop(media, issues: issues, refunded: response["refunded"] as? [String: Any])
                    continue
                }
                let updated = try await GeneratedOverlayService.save(reply: repair, brand: nil, moment: [:],
                    size: CGSize(width: media.width, height: media.height), instruction: "Automatic rendered review: " + issues.joined(separator: " "),
                    root: generatedAssetRoot ?? projectNavigation.currentPackage?.url ?? ProjectStore.directory, existing: media,
                    takenNames: project.media.filter { $0.id != media.id }.map(\.name))
                guard abs(updated.duration - media.duration) < 0.01 else {
                    drop(media, issues: ["The automatic repair changed its length."], refunded: nil)
                    continue
                }
                updateProject { project in
                    if let index = project.media.firstIndex(where: { $0.id == media.id }) { project.media[index] = updated }
                }
                repairedIDs.insert(media.id)
            }
            // A repair changes the composite, so every card left is checked
            // again against the new render.
            if repairedIDs.isEmpty {
                updateProject { project in
                    for index in project.media.indices {
                        guard !droppedIDs.contains(project.media[index].id),
                              let notes = evidenceNotes[project.media[index].id],
                              let last = project.media[index].generated?.versions.indices.last else { continue }
                        project.media[index].generated?.versions[last].notes += notes
                    }
                }
                targets = []
            }
        }
        if !targets.isEmpty {
            throw NativeEditorError.aiFailed("The visual could not be verified. Your previous edit was kept.")
        }
        if runRefund > 0 { dropped.append(OverlayWorkflowOutcome.refundedPlan(credits: runRefund)) }
        return GeneratedOverlayReview(notes: dropped, dropped: droppedIDs)
    }

    /// Takes one generated asset back to how it was before this run: a new
    /// card leaves the project, a revised one gets its old version and its old
    /// timeline instances back, in their old order.
    func revertGeneratedChange(mediaID: UUID, to previous: EditorProject) {
        updateProject { project in
            if let old = previous.media.first(where: { $0.id == mediaID }) {
                if let index = project.media.firstIndex(where: { $0.id == mediaID }) { project.media[index] = old }
            } else {
                project.media.removeAll { $0.id == mediaID }
            }
            var overlays = (project.overlays ?? []).filter { $0.mediaID != mediaID }
            for (index, old) in (previous.overlays ?? []).enumerated() where old.mediaID == mediaID {
                overlays.insert(old, at: min(index, overlays.count))
            }
            project.overlays = overlays.isEmpty && previous.overlays == nil ? nil : overlays
        }
    }
}
