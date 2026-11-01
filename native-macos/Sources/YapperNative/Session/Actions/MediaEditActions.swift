import Foundation

extension AppActionRegistry {
    func registerMediaEditActions() {
        register(MediaEditInput.self, availability: { _ in .available }) { session, input in
            let ids = Set(input.mediaIDs)
            let media = input.mediaIDs.compactMap { id in session.project.media.first { $0.id == id } }
            guard media.count == ids.count else { throw AppActionError("Some imported media no longer exists.") }
            var project = session.project
            var changes: [AppActionChange] = []
            for item in media {
                switch input.operation {
                case .append:
                    guard !item.isScene else { throw AppActionError("Use Add as overlay for generated visuals.") }
                    let length = item.isImage ? EditorSession.imageClipDefaultDuration : item.duration
                    guard length > 0 else { throw AppActionError("That media has no playable duration.") }
                    let clip = TimelineClip(mediaID: item.id, sourceStart: 0, sourceEnd: length)
                    project.clips.append(clip)
                    changes.append(.init(targetID: clip.id, property: "clip", before: "none", after: item.name))
                case .remove:
                    guard !project.clips.contains(where: { $0.mediaID == item.id && $0.locked }),
                          !project.storedCaptions.contains(where: { $0.mediaID == item.id && $0.locked }) else {
                        throw AppActionError("Unlock this media’s clips and captions before removing it.")
                    }
                    let removedIDs = project.clips.filter { $0.mediaID == item.id }.map(\.id)
                        + (project.overlays ?? []).filter { $0.mediaID == item.id }.map(\.id)
                        + project.storedCaptions.filter { $0.mediaID == item.id }.map(\.id)
                    if project.removeImportedMedia(item.id) {
                        changes.append(.init(targetID: item.id, property: "media", before: item.name, after: "removed; source file kept"))
                        changes += removedIDs.map { .init(targetID: $0, property: "timelineItem", before: "present", after: "removed") }
                    }
                case .resetToSource:
                    guard !item.isImage && !item.isScene else { throw AppActionError("Choose video footage to reset to its full source.") }
                    guard !project.clips.contains(where: { $0.mediaID == item.id && $0.locked }) else {
                        throw AppActionError("Unlock this media’s clips before resetting them.")
                    }
                    if let clip = project.resetMainTrack(mediaID: item.id, sourceDuration: item.duration) {
                        changes.append(.init(targetID: clip.id, property: "source", before: "edited", after: "full source"))
                    }
                }
            }
            guard !changes.isEmpty else { return .init(message: "No media needed changing.") }
            project.updatedAt = Date()
            session.updateProject { $0 = project }
            return .init(message: "Media edit saved · ⌘Z to undo", changes: changes,
                         afterCommit: {
                             session.mediaSelection = session.mediaSelection.reconciled(against: session.project.media.map(\.id))
                             session.reconcileTimelineSelection()
                         })
        }
        register(TrackTransferInput.self, availability: { _ in .available }) { session, input in
            var project = session.project
            let newItem: TimelineSelectionItem
            let message: String
            switch input.direction {
            case .toOverlay:
                guard let clip = project.clips.first(where: { $0.id == input.itemID }), !clip.locked else {
                    throw AppActionError("Choose an unlocked clip to move to an overlay lane.")
                }
                guard input.insertionIndex == nil else { throw AppActionError("Use at and track when moving to an overlay lane.") }
                let start = try input.at.map { try TimelineCue.resolve($0, project: project, playhead: session.currentTime) }
                guard let overlay = project.promoteClipToOverlay(clip.id, start: start, lane: input.track) else {
                    throw AppActionError("A clip has to stay on the video track.")
                }
                guard !OverlayTracks.isOccupied(overlay.lane, by: (overlay.id, overlay.timelineStart, overlay.duration), in: project.overlays ?? []) else {
                    throw AppActionError("That overlay lane is occupied.")
                }
                newItem = .overlay(overlay.id)
                message = "Lifted to overlay lane \(overlay.lane + 1) · ⌘Z to undo"
            case .toMainTrack:
                guard input.at == nil, input.track == nil, let index = input.insertionIndex, index <= project.clips.count,
                      let overlay = project.overlays?.first(where: { $0.id == input.itemID }),
                      project.media.first(where: { $0.id == overlay.mediaID })?.isScene != true,
                      let clip = project.demoteOverlayToClip(input.itemID, insertionIndex: index) else {
                    throw AppActionError("Choose an image/video overlay and a valid main-track insertion index.")
                }
                newItem = .clip(clip.id)
                message = "Dropped onto the video track · ⌘Z to undo"
            }
            session.updateProject { $0 = project }
            return .init(message: message, changes: [
                .init(targetID: input.itemID, property: "track", before: "previous track", after: "replaced by \(newItem.id.uuidString)")
            ], afterCommit: { session.selectTimelineItem(newItem) })
        }
        register(ClearTrackInput.self, availability: { _ in .available }) { session, input in
            var project = session.project
            let changes: [AppActionChange]
            switch input.track {
            case .video:
                guard !project.clips.contains(where: \.locked) else { throw AppActionError("Unlock the clips before clearing the video track.") }
                changes = project.clips.map { .init(targetID: $0.id, property: "clip", before: "present", after: "removed") }
                project.clips = []
            case .captions:
                guard !project.storedCaptions.contains(where: \.locked) else { throw AppActionError("Unlock the captions before clearing them.") }
                changes = project.storedCaptions.map { .init(targetID: $0.id, property: "caption", before: "present", after: "removed") }
                    + (project.captionsEnabled == true ? [.init(targetID: project.id, property: "captionsVisible", before: "true", after: "false")] : [])
                project.clearCaptions()
            }
            session.updateProject { $0 = project }
            return .init(message: "Track cleared · ⌘Z to undo", changes: changes,
                         afterCommit: { session.reconcileTimelineSelection() })
        }
        register(CaptionSplitInput.self, availability: { _ in .available }) { session, input in
            guard let caption = session.project.caption(withID: input.captionID) else { throw AppActionError("That caption no longer exists.") }
            if caption.locked { return .init(message: "Locked caption skipped.", skippedIDs: [caption.id]) }
            var project = session.project
            guard let id = project.splitCaption(caption.id, afterWords: input.afterWords) else { throw AppActionError("Choose a word boundary inside the caption.") }
            session.updateProject { $0 = project }
            return .init(message: "Caption split · ⌘Z to undo", changes: [.init(targetID: caption.id, property: "split", before: "whole", after: id.uuidString)],
                         afterCommit: { session.setSelectedCaptionIDs([id]) })
        }
        registerWorkflow(HistoryInput.self) { session, input in
            switch input.direction {
            case .undo:
                guard session.canUndo else { throw AppActionError("There is nothing to undo.") }
            case .redo:
                guard session.canRedo else { throw AppActionError("There is nothing to redo.") }
            }
            await session.restoreHistory(input.direction)
            return Task.isCancelled
        }
    }
}
