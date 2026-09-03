import CoreGraphics
import Foundation

enum GeneratedOverlayCommand {
    static func removesWholeAsset(_ text: String) -> Bool {
        text.range(of: #"^\s*(please\s+)?(remove|delete)\s*(it|this overlay|the overlay)?\s*(from (the )?(video|timeline))?\s*[.!]?\s*$"#,
                   options: [.regularExpression, .caseInsensitive]) != nil
    }
    static func creates(_ instruction: String) -> Bool {
        let text = instruction.lowercased()
        let nouns = ["overlay", "visual", "animation", "diagram", "counter", "chart", "illustration", "graphic", "number"]
        let verbs = ["create", "generate", "design", "animate", "make", "add"]
        return nouns.contains(where: text.contains) && verbs.contains(where: text.contains)
            && !["existing", "imported", "my overlays", "these overlays"].contains(where: text.contains)
    }
}

@MainActor
extension EditorSession {
    func generatedMediaMentioned(in instruction: String) -> [ProjectMedia] {
        let names = OverlayMention.mentioned(in: instruction, names: project.media.filter(\.isScene).map(\.name))
        return project.media.filter { $0.isScene && names.contains($0.name) }
    }

    /// One user operation: direct, design, save and place; no approval stage.
    func performGeneratedOverlays(instruction: String, revising: [ProjectMedia]) async {
        setOverlayPlacement(.working)
        guard let rollback = await beginPreparedTimelineEdit() else {
            setOverlayPlacement(.failed("Another edit is in progress."))
            return
        }
        defer { endPreparedTimelineEdit() }
        do {
            let notes = try await revising.isEmpty
                ? createGeneratedOverlays(instruction: instruction)
                : reviseGeneratedOverlays(revising, instruction: instruction)
            try Task.checkCancellation()
            if project == rollback.project {
                setOverlayPlacement(.generated(notes: notes, changed: 0))
                setStatus("Ready")
                return
            }
            guard await commitPreparedTimelineEdit(rollbackState: rollback,
                successStatus: "Overlays updated · ⌘Z to undo") else {
                setOverlayPlacement(.failed(errorMessage ?? "The overlays could not be saved."))
                return
            }
            for media in project.media where media.isScene { await restartDerivedMedia(for: media) }
            let changedMedia = project.media.filter { media in
                media.isScene && rollback.project.media.first(where: { $0.id == media.id }) != media
            }.map(\.id)
            let before = rollback.project.overlays ?? []
            let after = project.overlays ?? []
            let changedInstances = (before.filter { !after.contains($0) } + after.filter { !before.contains($0) }).map(\.mediaID)
            setOverlayPlacement(.generated(notes: notes, changed: Set(changedMedia + changedInstances).count))
        } catch is CancellationError {
            markCurrentLongOperationCanceled()
            await restoreCanceledEditState(rollback, rebuildPlayer: true, status: "Overlay generation canceled")
            setOverlayPlacement(.idle)
        } catch {
            await restoreEditState(rollback, rebuildPlayer: true, preserving: error)
            setOverlayPlacement(.failed(error.localizedDescription))
        }
    }

    private var generatedRoot: URL {
        projectNavigation.currentPackage?.url ?? ProjectStore.directory
    }

    private func transcriptBody() -> [[String: String]] { placeableWords.map { ["text": $0.text] } }

    private func createGeneratedOverlays(instruction: String) async throws -> [String] {
        setStatus("Finding the moments a visual would help…")
        let speaker = await speakerTrack()
        let placed: [[String: Any]] = overlays.filter(\.isVisible).compactMap { overlay in
            guard let media = media(for: overlay) else { return nil }
            return ["name": String(media.name.prefix(80)), "at": overlay.timelineStart,
                    "duration": overlay.duration, "kind": media.isScene ? "scene" : media.isImage ? "image" : "video"]
        }
        var body: [String: Any] = ["instruction": instruction, "words": transcriptBody(),
            "frameAspect": project.resolvedAspectRatio, "placed": Array(placed.prefix(200)),
            "texts": Array((project.textLayers ?? []).prefix(200)).map { ["text": String($0.text.prefix(80)), "at": $0.timelineStart] },
            "speaker": Array(speaker.prefix(64)).map { ["at": $0.at, "x": $0.rect.minX, "y": $0.rect.minY, "width": $0.rect.width, "height": $0.rect.height] }]
        if captionsVisible {
            let rect = KeepOutRegions.captionBand(style: captionStyle).rect
            body["captionBand"] = ["y": rect.minY, "height": rect.height]
        }
        let direction = try await GeneratedOverlayService.request("direct-overlays", body: body)
        let moments = direction["moments"] as? [[String: Any]] ?? []
        var notes: [String] = []
        let words = placeableWords
        for moment in moments {
            try Task.checkCancellation()
            guard let quote = moment["quote"] as? String,
                  let span = OverlayPlan.quoteSpan(in: words, quote: quote) else {
                notes.append("Skipped a visual because its words did not match the transcript.")
                continue
            }
            let anchor = OverlayCue.anchor(in: words, span: span, cue: moment["cue"] as? String ?? "") ?? span.lowerBound
            let start = OverlayCue.start(forWordAt: project.nearestTimelineTime(for: words[anchor]))
            let last = words[span.upperBound]
            let end = min(project.duration, project.nearestTimelineTime(for: last) + max(0.08, last.end - last.start))
            let duration = min(30, end - start)
            guard duration >= 0.5 else { continue }
            var avoid = await speakerRegions(from: start, to: end)
            avoid += KeepOutRegions.safeZones(frameAspect: project.resolvedAspectRatio)
            avoid += KeepOutRegions.textLayers(project.textLayers ?? [], from: start, to: end, frameAspect: project.resolvedAspectRatio)
            if captionsVisible { avoid.append(KeepOutRegions.captionBand(style: captionStyle)) }
            avoid += overlays.filter { $0.isVisible && $0.timelineStart < end && $0.timelineStart + $0.duration > start }.map {
                SpeakerRegion(rect: CGRect(x: $0.x, y: $0.y, width: $0.width, height: $0.height), weight: 0.5)
            }
            let aspect = min(5, max(0.2, moment["aspect"] as? Double ?? 1.6))
            // Never full frame: a designed card that happens to share the
            // video's shape still has to sit beside the speaker.
            let box = OverlayLayout.solve(proposed: nil, mediaAspect: aspect,
                frameAspect: project.resolvedAspectRatio, avoid: avoid, fullFrame: .never)
            let size = CGSize(width: max(64, box.width * project.resolvedAspectRatio * 1080), height: max(64, box.height * 1080))
            var design = moment
            design["id"] = UUID().uuidString
            design["sentence"] = quote
            design["duration"] = duration
            design["wordTimings"] = words[span].prefix(100).map { word -> [String:Any] in
                let at = min(duration, max(0, project.nearestTimelineTime(for:word) - start))
                let end = min(duration, max(at, at + word.end - word.start))
                return ["text":word.text, "at":at, "end":end]
            }
            design["box"] = ["aspect": size.width / size.height, "widthPx": size.width, "heightPx": size.height]
            do {
            setStatus("Creating \(moment["name"] as? String ?? "your overlay")…")
            let response = try await GeneratedOverlayService.request("design-overlays", body: [
                "instruction": instruction, "frameAspect": project.resolvedAspectRatio,
                "frameHeightPx": 1080, "moments": [design]])
            guard let result = (response["scenes"] as? [[String: Any]])?.first else {
                notes.append("Couldn’t generate \(moment["name"] as? String ?? "that visual"); it was skipped.")
                continue
            }
            var media = try await GeneratedOverlayService.save(reply: result, brand: response["brand"] as? [String: Any],
                moment: moment, size: size, instruction: instruction, root: generatedRoot, takenNames: project.media.map(\.name))
            media.generated?.sourceMediaID = words[anchor].mediaID
            media.generated?.sourceStart = words[anchor].start
            media.generated?.sourceEnd = last.end
            let overlay = introducedOverlay(media: media, timelineStart: start, duration: duration, box: box)
            updateProject { project in
                project.media.append(media)
                project.overlays = (project.overlays ?? []) + [overlay]
            }
            notes.append("\(media.name) · \(formatTime(start)) · @-mention it to request changes")
            // Renderer repair diagnostics belong in the asset's version record,
            // not repeated as successful user-facing actions in Chirpy.
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                // Keep earlier successful designs in this batch; a later
                // provider failure must not discard media already delivered.
                notes.append("Couldn’t finish \(moment["name"] as? String ?? "that visual"): \(error.localizedDescription)")
            }
        }
        if notes.isEmpty { notes = [direction["passedOn"] as? String ?? "No moments needed another visual."] }
        return notes
    }

    private func reviseGeneratedOverlays(_ assets: [ProjectMedia], instruction: String) async throws -> [String] {
        var notes: [String] = []
        // Remove mention text before interpreting verbs: a name containing
        // "growth" or "remove" must not change the requested operation.
        var command = instruction.lowercased()
        for media in assets { command = command.replacingOccurrences(of: "@" + media.name.lowercased(), with: "") }
        for media in assets {
            try Task.checkCancellation()
            if GeneratedOverlayCommand.removesWholeAsset(command) {
                updateProject { project in project.overlays?.removeAll { $0.mediaID == media.id } }
                notes.append("Removed \(media.name) from the video; it remains in Media.")
                continue
            }
            let instances = overlays.filter { $0.mediaID == media.id }
            let reuse = ["reuse", "again", "another copy", "duplicate"].contains(where: command.contains)
                || (instances.isEmpty && ["add", "put", "place", "show", "use"].contains(where: command.contains))
            if reuse {
                var start = min(currentTime, max(0, project.duration - 0.5))
                if ["when", "where", "say", "sentence"].contains(where: command.contains) {
                    let response = try await GeneratedOverlayService.request("revise-overlay", body: [
                        "op": "retime", "instruction": instruction, "words": transcriptBody(), "quoteHint": media.generated?.quote ?? ""])
                    let words = placeableWords
                    guard let quote = response["quote"] as? String,
                          let span = OverlayPlan.quoteSpan(in: words, quote: quote) else {
                        notes.append("Couldn’t find that moment; no copy of \(media.name) was added.")
                        continue
                    }
                    let anchor = OverlayCue.anchor(in: words, span: span, cue: response["cue"] as? String ?? "") ?? span.lowerBound
                    start = OverlayCue.start(forWordAt: project.nearestTimelineTime(for: words[anchor]))
                }
                let duration = min(media.duration, project.duration - start)
                guard duration >= 0.5 else { continue }
                let copy = introducedOverlay(media: media, timelineStart: start, duration: duration)
                updateProject { $0.overlays = ($0.overlays ?? []) + [copy] }
                notes.append("Reused \(media.name) at \(formatTime(start)).")
                continue
            }
            if ["move", "show", "start", "appear"].contains(where: command.contains),
               ["when", "where", "sentence", "say"].contains(where: command.contains),
               let nearest = instances.min(by: { abs($0.timelineStart - currentTime) < abs($1.timelineStart - currentTime) }) {
                let response = try await GeneratedOverlayService.request("revise-overlay", body: [
                    "op": "retime", "instruction": instruction, "words": transcriptBody(), "quoteHint": media.generated?.quote ?? ""])
                let words = placeableWords
                guard let quote = response["quote"] as? String, let span = OverlayPlan.quoteSpan(in: words, quote: quote) else {
                    notes.append("Couldn’t find the requested moment for \(media.name); its timing is unchanged.")
                    continue
                }
                let anchor = OverlayCue.anchor(in: words, span: span, cue: response["cue"] as? String ?? "") ?? span.lowerBound
                let start = OverlayCue.start(forWordAt: project.nearestTimelineTime(for: words[anchor]))
                updateProject { project in
                    guard let index = project.overlays?.firstIndex(where: { $0.id == nearest.id }) else { return }
                    let duration = min(nearest.duration, project.duration - start)
                    project.overlays?[index].timelineStart = start
                    project.overlays?[index].duration = duration
                }
                notes.append("Moved \(media.name) to \(formatTime(start)).")
                continue
            }
            setStatus("Updating \(media.name)…")
            let scene = try SceneExportLayer.loadScene(for: media)
            let response = try await GeneratedOverlayService.request("revise-overlay", body: [
                "op": "restyle", "instruction": instruction, "frameAspect": project.resolvedAspectRatio,
                "frameHeightPx": 1080, "duration": scene.duration,
                "box": ["aspect": Double(media.width) / Double(media.height), "widthPx": media.width, "heightPx": media.height],
                "asset": ["name": media.name, "description": media.generated?.description ?? "", "brief": media.generated?.brief ?? "",
                          "quote": media.generated?.quote ?? "", "scene": try JSONSerialization.jsonObject(with: scene.encoded())]])
            let updated = try await GeneratedOverlayService.save(reply: response, brand: response["brand"] as? [String: Any],
                moment: [:], size: CGSize(width: media.width, height: media.height), instruction: instruction, root: generatedRoot,
                existing: media, takenNames: project.media.filter { $0.id != media.id }.map(\.name))
            updateProject { project in
                guard let index = project.media.firstIndex(where: { $0.id == media.id }) else { return }
                project.media[index] = updated
            }
            notes.append("Updated \(updated.name) everywhere it appears · ⌘Z to undo")
        }
        return notes
    }
}
