import AppKit
import Foundation

@MainActor
extension EditorSession {
    func performImageNumberReveal(instruction: String) async {
        setOverlayPlacement(.working)
        let named = OverlayMention.mentioned(in: instruction, names: placeableMedia.map(\.name))
        let images = placeableMedia.filter { named.contains($0.name) && $0.isImage && !$0.isScene }
        guard images.count == 1, let source = images.first else {
            setOverlayPlacement(.failed("Name one imported image with @ so I can time its numbers to your words."))
            return
        }
        let instances = overlays.filter { overlay in
            overlay.mediaID == source.id || media(for: overlay)?.generated?.revealSourceMediaID == source.id
        }
        guard let overlay = instances.min(by: { abs($0.timelineStart - currentTime) < abs($1.timelineStart - currentTime) }) else {
            setOverlayPlacement(.failed("Place this image on the timeline first so I know which spoken passage to use."))
            return
        }
        guard let rollback = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        do {
            setStatus("Reading the numbers in \(source.name)…")
            let prepared = try await ImageNumberRevealService().prepare(source.url)
            let regions = prepared.regions
            try Task.checkCancellation()
            let words = TimelineInspectionService.timelineWords(project: project)
            let cues = ImageNumberReveal.cues(regions: regions, words: words, overlay: overlay, projectDuration: duration)
            guard !cues.isEmpty else {
                throw NativeEditorError.aiFailed("None of this image’s numbers matched the speech near this overlay. Nothing was changed.")
            }
            let end = min(duration, max(overlay.timelineStart + overlay.duration, (cues.last?.end ?? 0) + 1))
            let length = end - overlay.timelineStart
            guard SceneLimits.duration.contains(length) else {
                throw NativeEditorError.aiFailed("A spoken reveal needs an overlay between half a second and 30 seconds long.")
            }
            let scene = ImageNumberReveal.scene(regions: regions, cues: cues, start: overlay.timelineStart, duration: length)
            setStatus("Timing the reveals to your words…")
            let root = generatedAssetRoot ?? projectNavigation.currentPackage?.url ?? ProjectStore.directory
            let existing = media(for: overlay).flatMap { $0.generated?.revealSourceMediaID == source.id ? $0 : nil }
            var revised = try await GeneratedOverlayService.save(reply: [
                "name": existing?.name ?? "\(source.name) · spoken reveal",
                "description": "Original image with spoken numbers revealed at their cues and other values always visible.",
                "scene": try JSONSerialization.jsonObject(with: scene.encoded()),
                "images": [["key": "original", "data": prepared.png.base64EncodedString()]],
            ], brand: nil, moment: ["quote": cues.map(\.spoken).joined(separator: " · ")],
                size: CGSize(width: source.width, height: source.height), instruction: instruction,
                root: root, existing: existing, takenNames: project.media.filter { $0.id != existing?.id }.map(\.name))
            revised.generated?.revealSourceMediaID = source.id
            revised.generated?.revealRegions = regions.enumerated().map { index, region in
                let cue = cues.first { $0.region == index }
                return SavedRevealRegion(id: "number-\(index)", text: region.text, label: region.label,
                    confidence: region.confidence, box: region.box, background: region.background,
                    policy: cue == nil ? .alwaysVisible : .untilCue, cueTime: cue.map { $0.at - overlay.timelineStart })
            }
            try Task.checkCancellation()
            updateProject { project in
                if let index = project.media.firstIndex(where: { $0.id == revised.id }) { project.media[index] = revised }
                else { project.media.append(revised) }
                if let index = project.overlays?.firstIndex(where: { $0.id == overlay.id }) {
                    project.overlays?[index].mediaID = revised.id
                    project.overlays?[index].sourceStart = 0
                    project.overlays?[index].duration = length
                }
            }
            guard await commitPreparedTimelineEdit(rollbackState: rollback, successStatus: "Timed number reveals · ⌘Z to undo") else {
                setOverlayPlacement(.failed(errorMessage ?? "The reveal could not be saved."))
                return
            }
            var notes = cues.map { "\(regions[$0.region].text) appears at \(formatTime($0.at)) as you say “\($0.spoken)”" }
            let visible = regions.indices.filter { index in !cues.contains { $0.region == index } }.map { regions[$0].text }
            if !visible.isEmpty { notes.append("Visible throughout: \(visible.joined(separator: ", ")).") }
            setOverlayPlacement(.generated(notes: notes, changed: 1))
        } catch is CancellationError {
            markCurrentLongOperationCanceled()
            await restoreCanceledEditState(rollback, rebuildPlayer: true, status: "Number reveal canceled")
            setOverlayPlacement(.idle)
        } catch {
            await restoreEditState(rollback, rebuildPlayer: true, preserving: error)
            setOverlayPlacement(.failed(error.localizedDescription))
        }
    }
}
