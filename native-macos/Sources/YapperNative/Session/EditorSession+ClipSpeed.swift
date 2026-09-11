import Foundation

@MainActor
extension EditorSession {
    var speedClip: TimelineClip? { selectedClip ?? framingClip }

    @discardableResult
    func setClipSpeed(_ rate: Double, applyToAll: Bool = false) async -> Bool {
        let result = await performAppAction(ClipSpeedInput(clipIDs: speedTargetIDs(applyToAll: applyToAll), rate: rate))
        return result.status == .applied
    }

    func speedTargetIDs(applyToAll: Bool = false) -> [UUID] {
        let selected = timelineSelection.compactMap { item -> UUID? in
            if case let .clip(id) = item { return id }; return nil
        }
        let targets = applyToAll ? project.clips.map(\.id)
            : (selected.isEmpty ? [speedClip?.id].compactMap { $0 } : selected)
        return targets.sorted { $0.uuidString < $1.uuidString }
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
        let clips = items.compactMap { item -> UUID? in
            if case let .clip(id) = item { return id }; return nil
        }.sorted { $0.uuidString < $1.uuidString }
        let captions = items.compactMap { item -> UUID? in
            if case let .caption(id) = item { return id }; return nil
        }.sorted { $0.uuidString < $1.uuidString }
        let result = await performAppAction(TimelineLockInput(clipIDs: clips, captionIDs: captions, locked: locked))
        return result.status == .applied
    }

    func toggleTimelineLock(_ item: TimelineSelectionItem) async {
        let items = timelineSelection.contains(item) ? timelineSelection : [item]
        await setTimelineItemsLocked(!isLocked(item), items: items)
    }
}
