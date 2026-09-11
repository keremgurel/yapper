import CoreGraphics
import Foundation

enum GeneratedOverlayCommand {
    static func removesWholeAsset(_ text: String) -> Bool {
        text.range(of: #"^\s*(please\s+)?(remove|delete)\s*(it|this overlay|the overlay)?\s*(from (the )?(video|timeline))?\s*[.!]?\s*$"#,
                   options: [.regularExpression, .caseInsensitive]) != nil
    }
    static func creates(_ instruction: String, hasImportedMedia: Bool = false) -> Bool {
        // The verb must act on a visual. Independent substring checks read
        // "put the overlays where they make sense" as "make overlays" and
        // started expensive rendering/design instead of placing the bin.
        let target = #"(?:overlays?|visuals?|animations?|diagrams?|counters?|charts?|illustrations?|graphics?|numbers?)\b"#
        let qualifiers = #"(?:(?:me|us|a|an|the|some|new|another|one|two|three|few|custom|animated|simple|small|branded|visual|dynamic)\s+)*"#
        let creation = #"\b(?:create|generate|design|draw|build|make|animate)\s+"# + qualifiers + target
        if instruction.range(of: creation, options: [.regularExpression, .caseInsensitive]) != nil {
            return true
        }
        // "Add overlays" means use the imported assets when there are any.
        // A new design must be explicit before we leave the placement path.
        let addition = hasImportedMedia
            ? #"\badd\s+(?:(?:me|us|a|an|some)\s+)*new\s+"# + qualifiers + target
            : #"\badd\s+"# + qualifiers + target
        return instruction.range(of: addition, options: [.regularExpression, .caseInsensitive]) != nil
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
            try await verifyGeneratedChanges(since: rollback.project, instruction: instruction)
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
            if Task.isCancelled {
                markCurrentLongOperationCanceled()
                await restoreCanceledEditState(rollback, rebuildPlayer: true, status: "Overlay generation canceled")
                setOverlayPlacement(.idle)
                return
            }
            await restoreEditState(rollback, rebuildPlayer: true, preserving: error)
            setOverlayPlacement(.failed(error.localizedDescription))
        }
    }

    private var generatedRoot: URL {
        generatedAssetRoot ?? projectNavigation.currentPackage?.url ?? ProjectStore.directory
    }

    private func transcriptBody() -> [[String: String]] { placeableWords.map { ["text": $0.text] } }

    private func createGeneratedOverlays(instruction: String) async throws -> [String] {
        setStatus("Inspecting the edited video…")
        let evidence = try await TimelineInspectionService.overview(project: project)
        setStatus("Finding the moments a visual would help…")
        let speaker = await speakerTrack()
        let placed: [[String: Any]] = overlays.filter(\.isVisible).compactMap { overlay in
            guard let media = media(for: overlay) else { return nil }
            return ["name": String(media.name.prefix(80)), "at": overlay.timelineStart,
                    "duration": overlay.duration, "kind": media.isScene ? "scene" : media.isImage ? "image" : "video"]
        }
        var body: [String: Any] = ["instruction": instruction, "words": transcriptBody(),
            "inspection": evidence,
            "frameAspect": project.resolvedAspectRatio, "placed": Array(placed.prefix(200)),
            "texts": Array((project.textLayers ?? []).prefix(200)).map { ["text": String($0.text.prefix(80)), "at": $0.timelineStart] },
            "speaker": Array(speaker.prefix(64)).map { ["at": $0.at, "x": $0.rect.minX, "y": $0.rect.minY, "width": $0.rect.width, "height": $0.rect.height] }]
        if captionsVisible {
            let rect = KeepOutRegions.captionBand(style: captionStyle).rect
            body["captionBand"] = ["y": rect.minY, "height": rect.height]
        }
        let direction = try await generatedOverlayRequest("direct-overlays", body)
        let moments = direction["moments"] as? [[String: Any]] ?? []
        var notes: [String] = []
        let words = placeableWords
        let timedWords = TimelineInspectionService.timelineWords(project: project)
        // Reserve every placement before starting concurrent design. The next
        // card must avoid earlier planned cards even though none are saved yet.
        var prepared: [(moment: [String: Any], design: [String: Any], size: CGSize,
                        box: OverlayBox, start: Double, duration: Double, anchor: Int, last: TranscriptWord)] = []
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
            avoid += prepared.filter { $0.start < end && $0.start + $0.duration > start }.map {
                SpeakerRegion(rect: CGRect(x: $0.box.x, y: $0.box.y, width: $0.box.width, height: $0.box.height), weight: 0.5)
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
            design["inspection"] = try await TimelineInspectionService.capture(project: project, times: [start + 0.08, (start + end) / 2, end - 0.08])
            design["wordTimings"] = words[span].prefix(100).compactMap { word -> [String:Any]? in
                guard let timing = timedWords.first(where: { $0.id == word.id && $0.at >= start - 0.2 }) else { return nil }
                let at = min(duration, max(0, timing.at - start))
                let end = min(duration, max(at, timing.end - start))
                return ["text":word.text, "at":at, "end":end]
            }
            design["box"] = ["aspect": size.width / size.height, "widthPx": size.width, "heightPx": size.height]
            prepared.append((moment, design, size, box, start, duration, anchor, last))
        }
        // Each batch uses the backend's three-worker pool. Commit replies in
        // input order, keyed by id, never by provider completion order.
        for offset in stride(from: 0, to: prepared.count, by: 3) {
            let batch = Array(prepared[offset..<min(offset + 3, prepared.count)])
            try Task.checkCancellation()
            do {
                setStatus("Creating \(batch.count) visual\(batch.count == 1 ? "" : "s")…")
                let response = try await generatedOverlayRequest("design-overlays", [
                    "instruction": instruction, "frameAspect": project.resolvedAspectRatio,
                    "frameHeightPx": 1080, "moments": batch.map(\.design)])
                for item in batch {
                    try Task.checkCancellation()
                    guard let result = (response["scenes"] as? [[String: Any]])?.first(where: { $0["id"] as? String == item.design["id"] as? String }) else {
                        notes.append("Couldn’t generate \(item.moment["name"] as? String ?? "that visual"); it was skipped.")
                        continue
                    }
                    do {
                        var media = try await GeneratedOverlayService.save(reply: result, brand: response["brand"] as? [String: Any],
                            moment: item.moment, size: item.size, instruction: instruction, root: generatedRoot, takenNames: project.media.map(\.name))
                        media.generated?.sourceMediaID = words[item.anchor].mediaID
                        media.generated?.sourceStart = words[item.anchor].start
                        media.generated?.sourceEnd = item.last.end
                        let overlay = introducedOverlay(media: media, timelineStart: item.start, duration: item.duration, box: item.box)
                        updateProject { project in
                            project.media.append(media)
                            project.overlays = (project.overlays ?? []) + [overlay]
                        }
                        notes.append("\(media.name) · \(formatTime(item.start)) · @-mention it to request changes")
                        // Renderer repair diagnostics belong in the asset's version record,
                        // not repeated as successful user-facing actions in Chirpy.
                    } catch is CancellationError { throw CancellationError() }
                      catch { notes.append("Couldn’t save \(item.moment["name"] as? String ?? "that visual"): \(error.localizedDescription)") }
                }
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                // Keep earlier successful designs in this batch; a later
                // provider failure must not discard media already delivered.
                notes.append("Couldn’t finish this batch of visuals: \(error.localizedDescription)")
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
            // "Use it again near the conclusion" is a second copy, and so is
            // any placing verb when nothing is on the timeline yet. A bare
            // "again" ("make it count up again") is not, which is why it only
            // counts beside one of the placing verbs.
            let placingVerb = ["add", "put", "place", "show", "use"].contains(where: command.contains)
            let reuse = ["reuse", "another copy", "duplicate"].contains(where: command.contains)
                || (command.contains("again") && placingVerb)
                || (instances.isEmpty && placingVerb)
            if reuse {
                var start = min(currentTime, max(0, project.duration - 0.5))
                if ["when", "where", "say", "sentence"].contains(where: command.contains) {
                    let response = try await generatedOverlayRequest("revise-overlay", [
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
            setStatus("Updating \(media.name)…")
            let scene = try SceneExportLayer.loadScene(for: media)
            let response = try await generatedOverlayRequest("revise-overlay", [
                "op": "edit", "instruction": instruction, "words": transcriptBody(), "frameAspect": project.resolvedAspectRatio,
                "frameHeightPx": 1080, "duration": scene.duration,
                "box": ["aspect": Double(media.width) / Double(media.height), "widthPx": media.width, "heightPx": media.height],
                "asset": ["name": media.name, "description": media.generated?.description ?? "", "brief": media.generated?.brief ?? "",
                          "quote": media.generated?.quote ?? "", "scene": try JSONSerialization.jsonObject(with: scene.encoded())]])
            let sceneChanged = response["sceneChanged"] as? Bool ?? true
            let nearest = instances.min(by: { abs($0.timelineStart - currentTime) < abs($1.timelineStart - currentTime) })
            var newStart: Double?
            if let quote = response["placementQuote"] as? String {
                guard let span = OverlayPlan.quoteSpan(in: placeableWords, quote: quote) else {
                    throw NativeEditorError.aiFailed("Couldn’t find the requested moment. Nothing was changed.")
                }
                newStart = OverlayCue.start(forWordAt: project.nearestTimelineTime(for: placeableWords[span.lowerBound]))
            } else if let shift = response["timelineShiftSeconds"] as? Double, let nearest {
                newStart = nearest.timelineStart + shift
            }
            if newStart != nil && nearest == nil {
                throw NativeEditorError.aiFailed("This overlay is not on the timeline yet.")
            }
            // Checked against the reply before anything is written, so a
            // revision that cannot fit leaves no orphaned version on disk.
            let revisedDuration = sceneChanged
                ? ((response["scene"] as? [String: Any])?["duration"] as? Double ?? media.duration)
                : media.duration
            let delta = revisedDuration - media.duration
            for instance in instances {
                let start = instance.id == nearest?.id ? (newStart ?? instance.timelineStart) : instance.timelineStart
                let duration = instance.duration + delta
                guard start >= 0, duration >= 0.5, start + duration <= project.duration + 0.01 else {
                    throw NativeEditorError.aiFailed("The revised overlay would extend outside the video. Nothing was changed.")
                }
            }
            let updated = sceneChanged ? try await GeneratedOverlayService.save(reply: response, brand: response["brand"] as? [String: Any],
                moment: [:], size: CGSize(width: media.width, height: media.height), instruction: instruction, root: generatedRoot,
                existing: media, takenNames: project.media.filter { $0.id != media.id }.map(\.name)) : media
            updateProject { project in
                guard let index = project.media.firstIndex(where: { $0.id == media.id }) else { return }
                project.media[index] = updated
                for index in project.overlays?.indices ?? 0..<0 where project.overlays?[index].mediaID == media.id {
                    project.overlays?[index].duration += delta
                    if project.overlays?[index].id == nearest?.id, let newStart {
                        project.overlays?[index].timelineStart = newStart
                    }
                }
            }
            if let hold = response["openingHoldSeconds"] as? Double {
                notes.append("\(updated.name): holds the earlier values for \(hold.formatted()) seconds, then animates to the new values.")
            } else if sceneChanged {
                notes.append("Updated \(updated.name) everywhere it appears · ⌘Z to undo")
            }
            if let newStart { notes.append("Moved \(media.name) to \(formatTime(newStart)).") }
        }
        return notes
    }
}
