import Foundation

@MainActor
extension EditorSession {
    var speedClip: TimelineClip? { selectedClip ?? framingClip }

    @discardableResult
    func setClipSpeed(_ rate: Double, applyToAll: Bool = false) async -> Bool {
        guard rate.isFinite, ClipSpeed.range.contains(rate) else { return false }
        let selected = Set(timelineSelection.compactMap { item -> UUID? in
            if case let .clip(id) = item { return id }; return nil
        })
        let targets = applyToAll ? Set(project.clips.map(\.id))
            : (selected.isEmpty ? Set([speedClip?.id].compactMap { $0 }) : selected)
        var changed = 0
        var skipped = 0
        var newTime = currentTime
        let success = await commitTimelineEdit(successStatus:
            "Speed \(ClipSpeed.label(rate)) · \(changed) clip\(changed == 1 ? "" : "s") · voice pitch preserved"
                + (skipped > 0 ? " · \(skipped) locked skipped" : "")) {
            let before = project
            updateProject { project in
                for index in project.clips.indices where targets.contains(project.clips[index].id) {
                    let clip = project.clips[index]
                    if clip.locked { skipped += 1; continue }
                    guard project.media(for: clip)?.isImage == false, clip.resolvedPlaybackRate != rate else { continue }
                    project.clips[index].playbackRate = rate == 1 ? nil : rate
                    changed += 1
                }
                guard changed > 0 else { return }
                let timing = ClipSpeedTimeMap(before: before.clips, after: project.clips)
                newTime = timing.map(currentTime)
                // Captions and framing keys stay anchored to source time.
                // Free-standing sounds and visuals follow their starting moment
                // while retaining their own playback duration and pitch.
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
            return changed > 0
        }
        if success { seekToTimelineTime(newTime) }
        else if changed == 0, skipped > 0 { setStatus("Selected clips are locked. Unlock them to change speed.") }
        return success
    }

    func isLocked(_ item: TimelineSelectionItem) -> Bool {
        switch item {
        case .clip(let id): project.clips.first { $0.id == id }?.locked == true
        case .caption(let id): project.captions?.first { $0.id == id }?.locked == true
        default: false
        }
    }

    @discardableResult
    func setTimelineItemsLocked(_ locked: Bool, items: Set<TimelineSelectionItem>) async -> Bool {
        await commitTimelineEdit(requiresRebuild: false, successStatus: locked ? "Selection locked" : "Selection unlocked") {
            let before = project
            updateProject { $0.setLocked(locked, items: items) }
            return project != before
        }
    }

    func toggleTimelineLock(_ item: TimelineSelectionItem) async {
        let items = timelineSelection.contains(item) ? timelineSelection : [item]
        await setTimelineItemsLocked(!isLocked(item), items: items)
    }
}
