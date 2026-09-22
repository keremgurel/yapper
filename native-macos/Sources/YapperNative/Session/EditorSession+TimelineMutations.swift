import Foundation

/// The timeline edits themselves, without a commit around them. The buttons
/// and Chirpy both reach these through the registered actions; the drag
/// commit reaches them directly inside its own transaction.
///
/// Each core reads what it needs from the session first and then writes
/// through `updateProject` in one pass, so nothing touches the project while
/// it is being mutated.
extension EditorSession {
    /// Which kind of item an ID names, or nil when nothing on the timeline has it.
    func timelineItem(for id: UUID) -> TimelineSelectionItem? {
        if project.clips.contains(where: { $0.id == id }) { return .clip(id) }
        if project.textLayers?.contains(where: { $0.id == id }) == true { return .text(id) }
        if project.overlays?.contains(where: { $0.id == id }) == true { return .overlay(id) }
        if project.audioLayers?.contains(where: { $0.id == id }) == true { return .audio(id) }
        if project.storedCaptions.contains(where: { $0.id == id }) { return .caption(id) }
        return nil
    }

    private func sameKind(as item: TimelineSelectionItem, id: UUID) -> TimelineSelectionItem {
        switch item {
        case .clip: .clip(id)
        case .text: .text(id)
        case .caption: .caption(id)
        case .overlay: .overlay(id)
        case .audio: .audio(id)
        }
    }

    /// Splits each item at a timeline time. Returns the tail produced for
    /// every item that was actually cut.
    func splitTimelineItems(_ selection: Set<TimelineSelectionItem>, at time: Double) -> [UUID: UUID] {
        // Everything that needs the session is read up front.
        let locked = Set(selection.filter { isLocked($0) })
        let captionCuts: [UUID: (cue: ProjectCaptionCue, wordsBefore: Int)] = Dictionary(uniqueKeysWithValues: selection.compactMap { item in
            guard case let .caption(id) = item, let cue = captionCueCache.cue(id) else { return nil }
            return (id, (cue, captionWordsBefore(id, time: time)))
        })
        let pictureOverlays = Set((project.overlays ?? []).filter { media(for: $0)?.isPicture == true }.map(\.id))

        var tails: [UUID: UUID] = [:]
        updateProject { project in
            for item in selection.subtracting(locked) {
                switch item {
                case let .clip(id):
                    guard project.split(clipID: id, atTimelineTime: time) else { continue }
                    if let hit = project.clip(at: min(project.duration, time + 0.000_1)) {
                        tails[id] = project.clips[hit.index].id
                    }
                case let .text(id):
                    guard let index = project.textLayers?.firstIndex(where: { $0.id == id }),
                          let layer = project.textLayers?[index],
                          time > layer.timelineStart + 0.02,
                          time < layer.timelineStart + layer.duration - 0.02 else { continue }
                    var left = layer
                    left.duration = time - layer.timelineStart
                    let right = ProjectTextLayer(
                        text: layer.text, timelineStart: time, duration: layer.duration - left.duration,
                        x: layer.x, y: layer.y, width: layer.width, appearance: layer.appearance)
                    project.textLayers?.replaceSubrange(index ... index, with: [left, right])
                    tails[id] = right.id
                case let .caption(id):
                    guard let cut = captionCuts[id],
                          time > cut.cue.timelineStart + 0.02, time < cut.cue.timelineEnd - 0.02,
                          let tail = project.splitCaption(id, afterWords: cut.wordsBefore) else { continue }
                    tails[id] = tail
                case let .overlay(id):
                    guard let index = project.overlays?.firstIndex(where: { $0.id == id }),
                          let overlay = project.overlays?[index],
                          time > overlay.timelineStart + 0.02,
                          time < overlay.timelineStart + overlay.duration - 0.02 else { continue }
                    let elapsed = time - overlay.timelineStart
                    let left = OverlayKeyTrack.portion(of: overlay, from: 0, duration: elapsed)
                    var right = OverlayKeyTrack.portion(of: overlay, from: elapsed, duration: overlay.duration - elapsed)
                    right.id = UUID()
                    if !pictureOverlays.contains(id) { right.sourceStart += elapsed * overlay.resolvedPlaybackRate }
                    project.overlays?.replaceSubrange(index ... index, with: [left, right])
                    tails[id] = right.id
                case let .audio(id):
                    guard let index = project.audioLayers?.firstIndex(where: { $0.id == id }),
                          let layer = project.audioLayers?[index],
                          time > layer.timelineStart + 0.02,
                          time < layer.timelineStart + layer.duration - 0.02 else { continue }
                    let elapsed = time - layer.timelineStart
                    var left = layer
                    left.duration = elapsed
                    let right = ProjectAudioLayer(
                        url: layer.url, name: layer.name, timelineStart: time, duration: layer.duration - elapsed,
                        sourceStart: layer.sourceStart + elapsed * layer.resolvedPlaybackRate,
                        sourceDuration: layer.sourceDuration, volume: layer.volume, builtInID: layer.builtInID,
                        sourceKind: layer.sourceKind, sourceFingerprint: layer.sourceFingerprint,
                        savedAudioID: layer.savedAudioID, savedAudioHash: layer.savedAudioHash,
                        packagedMediaID: layer.packagedMediaID, playbackRate: layer.playbackRate)
                    project.audioLayers?.replaceSubrange(index ... index, with: [left, right])
                    tails[id] = right.id
                }
            }
        }
        if !tails.isEmpty {
            let kinds = Dictionary(uniqueKeysWithValues: selection.map { ($0.id, $0) })
            setTimelineSelection(Set(tails.compactMap { original, tail in kinds[original].map { sameKind(as: $0, id: tail) } }))
        }
        return tails
    }

    /// Removes the items. Locked clips and captions are left where they are
    /// and returned so the caller can say so.
    func removeTimelineItems(_ selection: Set<TimelineSelectionItem>) -> (removed: [TimelineSelectionItem], skipped: [UUID]) {
        let skipped = selection.filter { isLocked($0) }
        let removable = selection.subtracting(skipped)
        guard !removable.isEmpty else { return ([], skipped.map(\.id)) }
        let clipIDs = Set(removable.compactMap { if case let .clip(id) = $0 { id } else { nil } })
        let textIDs = Set(removable.compactMap { if case let .text(id) = $0 { id } else { nil } })
        let overlayIDs = Set(removable.compactMap { if case let .overlay(id) = $0 { id } else { nil } })
        let audioIDs = Set(removable.compactMap { if case let .audio(id) = $0 { id } else { nil } })
        let captionIDs = removable.compactMap { if case let .caption(id) = $0 { id } else { nil } }
        updateProject { project in
            project.clips.removeAll { clipIDs.contains($0.id) }
            project.textLayers?.removeAll { textIDs.contains($0.id) }
            project.overlays?.removeAll { overlayIDs.contains($0.id) }
            project.audioLayers?.removeAll { audioIDs.contains($0.id) }
            for id in captionIDs { project.removeCaption(id) }
        }
        setTimelineSelection([])
        placePlayhead(at: min(currentTime, project.duration))
        return (Array(removable), skipped.map(\.id))
    }

    /// Moves one edge of each item to a timeline time. Returns the items that
    /// changed and, for a leading trim, where the earliest clip used to start
    /// so the playhead can follow the cut.
    func trimTimelineItems(
        _ selection: Set<TimelineSelectionItem>, edge: TimelineEditEdge, to time: Double
    ) -> (changed: [TimelineSelectionItem], leadingBoundary: Double?, skipped: [UUID]) {
        let originalClipStarts = Dictionary(uniqueKeysWithValues: project.clips.compactMap { clip in
            project.timelineStart(for: clip.id).map { (clip.id, $0) }
        })
        let skipped = selection.filter { isLocked($0) }.map(\.id)
        let cues: [UUID: ProjectCaptionCue] = Dictionary(uniqueKeysWithValues: selection.compactMap { item in
            guard case let .caption(id) = item, let cue = captionCueCache.cue(id) else { return nil }
            return (id, cue)
        })
        let pictureOverlays = Set((project.overlays ?? []).filter { media(for: $0)?.isPicture == true }.map(\.id))

        var changed: [TimelineSelectionItem] = []
        var leadingClipBoundary: Double?
        updateProject { project in
            for item in selection where !skipped.contains(item.id) {
                switch item {
                case let .clip(id):
                    guard let index = project.clips.firstIndex(where: { $0.id == id }),
                          let start = originalClipStarts[id] else { continue }
                    var clip = project.clips[index]
                    let elapsed = time - start
                    guard elapsed > 1.0 / 30.0, elapsed < clip.duration - 1.0 / 30.0 else { continue }
                    let sourceTime = clip.sourceTime(atOffset: elapsed)
                    if edge == .leading {
                        clip.sourceStart = sourceTime
                        leadingClipBoundary = min(leadingClipBoundary ?? start, start)
                    } else {
                        clip.sourceEnd = sourceTime
                    }
                    if project.applyManualClipTrim(clip) { changed.append(item) }
                case let .text(id):
                    guard let index = project.textLayers?.firstIndex(where: { $0.id == id }),
                          var layer = project.textLayers?[index],
                          time > layer.timelineStart + 0.02,
                          time < layer.timelineStart + layer.duration - 0.02 else { continue }
                    let end = layer.timelineStart + layer.duration
                    if edge == .leading {
                        layer.timelineStart = time
                        layer.duration = end - time
                    } else {
                        layer.duration = time - layer.timelineStart
                    }
                    project.textLayers?[index] = layer
                    changed.append(item)
                case let .caption(id):
                    guard let cue = cues[id], time > cue.timelineStart + 0.02, time < cue.timelineEnd - 0.02 else { continue }
                    if project.retimeCaption(id,
                        toTimelineStart: edge == .leading ? time : cue.timelineStart,
                        end: edge == .leading ? cue.timelineEnd : time) {
                        changed.append(item)
                    }
                case let .overlay(id):
                    guard let index = project.overlays?.firstIndex(where: { $0.id == id }),
                          var overlay = project.overlays?[index],
                          time > overlay.timelineStart + 0.02,
                          time < overlay.timelineStart + overlay.duration - 0.02 else { continue }
                    let end = overlay.timelineStart + overlay.duration
                    if edge == .leading {
                        let elapsed = time - overlay.timelineStart
                        overlay.timelineStart = time
                        if !pictureOverlays.contains(id) { overlay.sourceStart += elapsed * overlay.resolvedPlaybackRate }
                        overlay.duration = end - time
                        overlay = OverlayKeyTrack.rebased(overlay, by: elapsed)
                    } else {
                        overlay.duration = time - overlay.timelineStart
                    }
                    project.overlays?[index] = overlay
                    changed.append(item)
                case let .audio(id):
                    guard let index = project.audioLayers?.firstIndex(where: { $0.id == id }),
                          var layer = project.audioLayers?[index],
                          time > layer.timelineStart + 0.02,
                          time < layer.timelineStart + layer.duration - 0.02 else { continue }
                    let end = layer.timelineStart + layer.duration
                    if edge == .leading {
                        let elapsed = time - layer.timelineStart
                        layer.timelineStart = time
                        layer.sourceStart += elapsed * layer.resolvedPlaybackRate
                        layer.duration = end - time
                    } else {
                        layer.duration = time - layer.timelineStart
                    }
                    project.audioLayers?[index] = layer
                    changed.append(item)
                }
            }
        }
        if !changed.isEmpty {
            var playhead = currentTime
            if edge == .leading, let leadingClipBoundary { playhead = leadingClipBoundary }
            placePlayhead(at: min(playhead, project.duration))
        }
        return (changed, leadingClipBoundary, skipped)
    }

    /// Moves a block of clips so it starts at `insertionIndex` among the rest.
    func reorderClips(_ ids: Set<UUID>, insertionIndex: Int) -> Bool {
        let block = project.clips.filter { ids.contains($0.id) }
        guard !block.isEmpty else { return false }
        var reordered = project.clips.filter { !ids.contains($0.id) }
        reordered.insert(contentsOf: block, at: min(max(0, insertionIndex), reordered.count))
        guard reordered.map(\.id) != project.clips.map(\.id) else { return false }
        updateProject { $0.clips = reordered }
        return true
    }

    /// Slides text, overlays, sounds, and captions along the timeline. Clips
    /// live in a running order and are reordered instead.
    func shiftTimelineItems(_ selection: Set<TimelineSelectionItem>, by delta: Double) -> Bool {
        let length = duration
        var changed = false
        updateProject { project in
            func slide(_ start: Double, _ itemDuration: Double) -> Double {
                min(max(0, length - itemDuration), max(0, start + delta))
            }
            if var layers = project.textLayers {
                for index in layers.indices where selection.contains(.text(layers[index].id)) {
                    let start = slide(layers[index].timelineStart, layers[index].duration)
                    if start != layers[index].timelineStart { layers[index].timelineStart = start; changed = true }
                }
                project.textLayers = layers
            }
            if var overlays = project.overlays {
                for index in overlays.indices where selection.contains(.overlay(overlays[index].id)) {
                    let start = slide(overlays[index].timelineStart, overlays[index].duration)
                    if start != overlays[index].timelineStart { overlays[index].timelineStart = start; changed = true }
                }
                project.overlays = overlays
            }
            if var layers = project.audioLayers {
                for index in layers.indices where selection.contains(.audio(layers[index].id)) {
                    let start = slide(layers[index].timelineStart, layers[index].duration)
                    if start != layers[index].timelineStart { layers[index].timelineStart = start; changed = true }
                }
                project.audioLayers = layers
            }
        }
        for item in selection {
            guard case let .caption(id) = item, !isLocked(item) else { continue }
            if nudgeCaption(id, by: delta) { changed = true }
        }
        return changed
    }

    /// Cuts spoken words out of the edit, or puts them back. Returns the
    /// words whose state changed; the first restored word is where the
    /// playhead lands afterwards.
    func setTranscriptWordsKept(_ ids: Set<UUID>, kept: Bool) -> [TranscriptWord] {
        let words = (project.transcript ?? []).filter { ids.contains($0.id) && project.isWordKept($0) != kept }
        guard !words.isEmpty else { return [] }
        let ranges = TranscriptWordSelection.sourceRanges(for: Set(words.map(\.id)), in: project.transcript ?? [])
        let limits = Dictionary(uniqueKeysWithValues: project.media.map { ($0.id, $0.duration) })
        updateProject { project in
            if kept {
                for range in ranges {
                    project.restoreSourceRange((range.start, min(limits[range.mediaID] ?? .greatestFiniteMagnitude, range.end)), for: range.mediaID)
                }
                project.captionRestoredWords()
            } else {
                for mediaID in Set(ranges.map(\.mediaID)) {
                    let limit = limits[mediaID] ?? .greatestFiniteMagnitude
                    project.removeSourceRanges(ranges.filter { $0.mediaID == mediaID }.map { ($0.start, min(limit, $0.end)) }, for: mediaID)
                }
            }
        }
        placePlayhead(at: kept ? project.nearestTimelineTime(for: words[0]) : min(currentTime, project.duration))
        selectedClipID = project.clip(at: min(currentTime, project.duration)).map { project.clips[$0.index].id }
        return words
    }

    /// Cuts a pause (a stretch of recording with no words) or puts it back.
    func setTranscriptPauseKept(mediaID: UUID, start: Double, end: Double, kept: Bool) -> Bool {
        guard end - start >= 0.02, project.isSourceRangeKept(mediaID: mediaID, start: start, end: end) != kept else { return false }
        updateProject { project in
            if kept {
                project.restoreSourceRange((start, end), for: mediaID)
                project.captionRestoredWords()
            } else {
                project.removeSourceRanges([(start, end)], for: mediaID)
            }
        }
        placePlayhead(at: kept
            ? project.nearestTimelineTime(for: TranscriptWord(mediaID: mediaID, text: "", start: start, end: end))
            : min(currentTime, project.duration))
        selectedClipID = project.clip(at: currentTime).map { project.clips[$0.index].id }
        return true
    }
}

extension TimelineAnchorInput {
    /// The playhead, for buttons that act where the creator is looking.
    static let playhead = TimelineAnchorInput(kind: .playhead, time: nil, phrase: nil, occurrence: nil, eventID: nil, offset: nil)
}
