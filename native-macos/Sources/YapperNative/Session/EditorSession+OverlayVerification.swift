import Foundation

@MainActor
extension EditorSession {
    /// Reviews the staged composition before the existing prepared-edit
    /// transaction saves anything. Every changed visible instance is checked,
    /// including reused/moved assets and revisions appearing more than once.
    func verifyGeneratedChanges(since previous: EditorProject, instruction: String) async throws {
        let changedIDs = Set(project.media.filter { media in
            media.isScene && previous.media.first(where: { $0.id == media.id }) != media
        }.map(\.id))
        let targets = (project.overlays ?? []).filter { overlay in
            overlay.isVisible && project.media.contains { $0.id == overlay.mediaID && $0.isScene } &&
            (changedIDs.contains(overlay.mediaID) || !(previous.overlays ?? []).contains(overlay))
        }.map(\.id)
        guard !targets.isEmpty else { return }

        for pass in 0..<3 {
            try Task.checkCancellation()
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
                guard let overlay = project.overlays?.first(where: { $0.id == id }),
                      let media = project.media.first(where: { $0.id == overlay.mediaID }) else {
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
                let response = try await generatedOverlayRequest("review-overlay", [
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
                              "scene": try JSONSerialization.jsonObject(with: scene.encoded())]])
                guard let passed = response["passed"] as? Bool,
                      let issues = response["issues"] as? [String], passed == issues.isEmpty else {
                    throw NativeEditorError.aiFailed("The visual check returned an unreadable result. Nothing was saved.")
                }
                if passed {
                    evidenceNotes[media.id, default: []].append("Composited-frame review passed at edited seconds: " + times.map { String(format: "%.2f", $0) }.joined(separator: ", ") + ". Sampled visual review, not an audio listening test.")
                    continue
                }
                guard pass < 2, let repair = response["repaired"] as? [String: Any] else {
                    throw NativeEditorError.aiFailed("The visual still needs work, so your previous edit was kept. " + issues.prefix(2).joined(separator: " "))
                }
                let updated = try await GeneratedOverlayService.save(reply: repair, brand: nil, moment: [:],
                    size: CGSize(width: media.width, height: media.height), instruction: "Automatic rendered review: " + issues.joined(separator: " "),
                    root: generatedAssetRoot ?? projectNavigation.currentPackage?.url ?? ProjectStore.directory, existing: media,
                    takenNames: project.media.filter { $0.id != media.id }.map(\.name))
                guard abs(updated.duration - media.duration) < 0.01 else {
                    throw NativeEditorError.aiFailed("The visual repair changed its duration. Your previous edit was kept.")
                }
                updateProject { project in
                    if let index = project.media.firstIndex(where: { $0.id == media.id }) { project.media[index] = updated }
                }
                repairedIDs.insert(media.id)
            }
            if repairedIDs.isEmpty {
                updateProject { project in
                    for index in project.media.indices {
                        guard let notes = evidenceNotes[project.media[index].id],
                              let last = project.media[index].generated?.versions.indices.last else { continue }
                        project.media[index].generated?.versions[last].notes += notes
                    }
                }
                return
            }
        }
        throw NativeEditorError.aiFailed("The visual could not be verified. Your previous edit was kept.")
    }
}
