import Foundation

/// Cutting and arranging the timeline: split, delete, trim, reorder, shift,
/// and word-level transcript cuts. The executors call the same mutation cores
/// the timeline's own commands use.
extension AppActionRegistry {
    func registerTimelineActions() {
        registerTimelineSplit()
        registerTimelineDelete()
        registerTimelineTrim()
        registerClipReorder()
        registerTimelineShift()
        registerTranscriptWords()
        registerTranscriptPause()
    }

    /// Resolves item IDs to typed timeline items, refusing anything unknown.
    private static func items(_ ids: [UUID], in session: EditorSession) throws -> Set<TimelineSelectionItem> {
        var result: Set<TimelineSelectionItem> = []
        for id in ids {
            guard let item = session.timelineItem(for: id) else { throw AppActionError("A requested timeline item no longer exists.") }
            result.insert(item)
        }
        return result
    }

    private static func kind(_ item: TimelineSelectionItem) -> String {
        switch item {
        case .clip: "clip"
        case .text: "text"
        case .caption: "caption"
        case .overlay: "overlay"
        case .audio: "sound"
        }
    }

    private static func count(_ n: Int, _ noun: String) -> String { "\(n) \(noun)\(n == 1 ? "" : "s")" }

    private static var timelineAvailability: (EditorSession) -> AppActionAvailability {
        { session in session.project.clips.isEmpty ? .init(reason: "Add video to the timeline first.") : .available }
    }

    private func registerTimelineSplit() {
        register(TimelineSplitInput.self, availability: Self.timelineAvailability) { session, input in
            let selection = try Self.items(input.itemIDs, in: session)
            let time = try TimelineCue.resolve(input.at, project: session.project, playhead: session.currentTime)
            let tails = session.splitTimelineItems(selection, at: time)
            let changes = tails.sorted { $0.key.uuidString < $1.key.uuidString }.map { original, tail in
                AppActionChange(targetID: original, property: "split", before: "whole", after: "tail \(tail.uuidString)")
            }
            let skipped = selection.filter { session.isLocked($0) }.map(\.id)
            let missed = selection.count - tails.count - skipped.count
            let message = tails.isEmpty
                ? (skipped.isEmpty ? "Nothing spans \(String(format: "%.2f", time))s to split." : "Nothing split; locked items were skipped.")
                : "Split \(Self.count(tails.count, "item")) at \(String(format: "%.2f", time))s" + (missed > 0 ? " · \(missed) not spanning that time" : "")
            return AppActionMutation(message: message, changes: changes, skippedIDs: skipped)
        }
    }

    private func registerTimelineDelete() {
        register(TimelineDeleteInput.self, availability: Self.timelineAvailability) { session, input in
            let selection = try Self.items(input.itemIDs, in: session)
            let (removed, skipped) = session.removeTimelineItems(selection)
            let changes = removed.sorted { $0.id.uuidString < $1.id.uuidString }.map {
                AppActionChange(targetID: $0.id, property: "removed", before: Self.kind($0), after: "none")
            }
            let message = removed.isEmpty ? "Nothing removed; locked items were skipped."
                : "Removed \(Self.count(removed.count, "item"))" + (skipped.isEmpty ? "" : " · \(skipped.count) locked skipped")
            return AppActionMutation(message: message, changes: changes, skippedIDs: skipped)
        }
    }

    private func registerTimelineTrim() {
        register(TimelineTrimInput.self, availability: Self.timelineAvailability) { session, input in
            let selection = try Self.items(input.itemIDs, in: session)
            let time = try TimelineCue.resolve(input.to, project: session.project, playhead: session.currentTime)
            let edge: TimelineEditEdge = input.edge == .leading ? .leading : .trailing
            let before = session.project
            let (changed, _, skipped) = session.trimTimelineItems(selection, edge: edge, to: time)
            var changes: [AppActionChange] = []
            for item in changed.sorted(by: { $0.id.uuidString < $1.id.uuidString }) {
                switch item {
                case let .clip(id):
                    if let old = before.clips.first(where: { $0.id == id }), let new = session.project.clips.first(where: { $0.id == id }) {
                        changes += try PropertyChanges.diff(targetID: id, before: old, after: new)
                    }
                case let .text(id):
                    if let old = before.textLayers?.first(where: { $0.id == id }), let new = session.project.textLayers?.first(where: { $0.id == id }) {
                        changes += try PropertyChanges.diff(targetID: id, before: [old.timelineStart, old.duration], after: [new.timelineStart, new.duration], prefix: "startAndDuration")
                    }
                case let .overlay(id):
                    if let old = before.overlays?.first(where: { $0.id == id }), let new = session.project.overlays?.first(where: { $0.id == id }) {
                        changes += try PropertyChanges.diff(targetID: id, before: [old.timelineStart, old.duration], after: [new.timelineStart, new.duration], prefix: "startAndDuration")
                    }
                case let .audio(id):
                    if let old = before.audioLayers?.first(where: { $0.id == id }), let new = session.project.audioLayers?.first(where: { $0.id == id }) {
                        changes += try PropertyChanges.diff(targetID: id, before: [old.timelineStart, old.duration], after: [new.timelineStart, new.duration], prefix: "startAndDuration")
                    }
                case let .caption(id):
                    changes.append(.init(targetID: id, property: edge == .leading ? "timelineStart" : "timelineEnd", before: "previous", after: String(format: "%.3f", time)))
                }
            }
            let message = changed.isEmpty
                ? (skipped.isEmpty ? "Nothing spans \(String(format: "%.2f", time))s to trim." : "Nothing trimmed; locked items were skipped.")
                : "Trimmed \(Self.count(changed.count, "item")) \(edge == .leading ? "to start" : "to end") at \(String(format: "%.2f", time))s"
            return AppActionMutation(message: message, changes: changes, skippedIDs: skipped)
        }
    }

    private func registerClipReorder() {
        register(ClipReorderInput.self, availability: { session in
            session.project.clips.count > 1 ? .available : .init(reason: "There is only one clip to order.")
        }) { session, input in
            let ids = Set(input.clipIDs)
            guard ids.isSubset(of: Set(session.project.clips.map(\.id))) else { throw AppActionError("A requested clip no longer exists.") }
            let before = session.project.clips.map(\.id)
            guard session.reorderClips(ids, insertionIndex: input.insertionIndex) else {
                return AppActionMutation(message: "The clips are already in that order.")
            }
            let after = session.project.clips.map(\.id)
            let changes = after.enumerated().compactMap { index, id -> AppActionChange? in
                guard let old = before.firstIndex(of: id), old != index else { return nil }
                return .init(targetID: id, property: "index", before: String(old), after: String(index))
            }
            return AppActionMutation(message: "Moved \(Self.count(ids.count, "clip")) to position \(input.insertionIndex + 1)", changes: changes)
        }
    }

    private func registerTimelineShift() {
        register(TimelineShiftInput.self, availability: Self.timelineAvailability) { session, input in
            let selection = try Self.items(input.itemIDs, in: session)
            if let clip = selection.first(where: { if case .clip = $0 { true } else { false } }) {
                throw AppActionError("Clip \(clip.id.uuidString) is in the running order; use editor.clips.reorder to move it.")
            }
            let before = session.project
            guard session.shiftTimelineItems(selection, by: input.deltaSeconds) else {
                return AppActionMutation(message: "Those items are already there.")
            }
            func start(_ item: TimelineSelectionItem, in project: EditorProject) -> Double? {
                switch item {
                case let .text(id): project.textLayers?.first { $0.id == id }?.timelineStart
                case let .overlay(id): project.overlays?.first { $0.id == id }?.timelineStart
                case let .audio(id): project.audioLayers?.first { $0.id == id }?.timelineStart
                case let .caption(id): project.captionCues.first { $0.id == id }?.timelineStart
                case .clip: nil
                }
            }
            let changes = selection.sorted { $0.id.uuidString < $1.id.uuidString }.compactMap { item -> AppActionChange? in
                guard let old = start(item, in: before), let new = start(item, in: session.project), old != new else { return nil }
                return .init(targetID: item.id, property: "timelineStart", before: String(old), after: String(new))
            }
            let direction = input.deltaSeconds < 0 ? "earlier" : "later"
            return AppActionMutation(message: "Moved \(Self.count(changes.count, "item")) \(String(format: "%.2f", abs(input.deltaSeconds)))s \(direction)",
                                     changes: changes, skippedIDs: selection.filter { session.isLocked($0) }.map(\.id))
        }
    }

    private func registerTranscriptWords() {
        register(TranscriptWordsInput.self, availability: { session in
            (session.project.transcript ?? []).isEmpty ? .init(reason: "Transcribe the video before cutting words.") : .available
        }) { session, input in
            let ids = Set(input.wordIDs)
            guard ids.isSubset(of: Set((session.project.transcript ?? []).map(\.id))) else {
                throw AppActionError("A requested transcript word no longer exists.")
            }
            let words = session.setTranscriptWordsKept(ids, kept: input.kept)
            let changes = words.map {
                AppActionChange(targetID: $0.id, property: "kept", before: String(!input.kept), after: String(input.kept))
            }
            let seekTo = session.currentTime
            let spoken = words.map(\.text).joined(separator: " ")
            let message = words.isEmpty ? (input.kept ? "Those words are already in the edit." : "Those words are already cut.")
                : (input.kept ? "Restored" : "Cut") + " \(Self.count(words.count, "word")) · “\(spoken.prefix(60))\(spoken.count > 60 ? "…" : "")”"
            return AppActionMutation(message: message, changes: changes,
                                     afterCommit: { if input.kept { session.seekToTimelineTime(seekTo) } })
        }
    }

    private func registerTranscriptPause() {
        register(TranscriptPauseInput.self, availability: { session in
            (session.project.transcript ?? []).isEmpty ? .init(reason: "Transcribe the video before cutting pauses.") : .available
        }) { session, input in
            guard session.project.media.contains(where: { $0.id == input.mediaID }) else { throw AppActionError("That recording is not in the project.") }
            guard input.end - input.start >= 0.02 else { throw AppActionError("A pause needs a start before its end.") }
            guard session.setTranscriptPauseKept(mediaID: input.mediaID, start: input.start, end: input.end, kept: input.kept) else {
                return AppActionMutation(message: input.kept ? "That pause is already in the edit." : "That pause is already cut.")
            }
            let seekTo = session.currentTime
            let length = String(format: "%.1f", input.end - input.start)
            return AppActionMutation(message: (input.kept ? "Restored" : "Cut") + " a \(length)s pause",
                changes: [.init(targetID: input.mediaID, property: "pause \(String(format: "%.2f", input.start))-\(String(format: "%.2f", input.end))",
                                before: String(!input.kept), after: String(input.kept))],
                afterCommit: { if input.kept { session.seekToTimelineTime(seekTo) } })
        }
    }
}
