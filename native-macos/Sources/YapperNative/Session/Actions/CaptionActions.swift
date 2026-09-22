import Foundation

/// Caption cards as actions: add, remove, merge, rewrite, and move. Style is
/// `editor.captions.setStyle`; splitting is `editor.timeline.split`.
extension AppActionRegistry {
    func registerCaptionActions() {
        registerCaptionAdd()
        registerCaptionRemove()
        registerCaptionMerge()
        registerCaptionText()
        registerCaptionRetime()
    }

    private static var captionAvailability: (EditorSession) -> AppActionAvailability {
        { session in session.project.storedCaptions.isEmpty ? .init(reason: "Generate captions first.") : .available }
    }

    private static func requireCaptions(_ ids: [UUID], in session: EditorSession) throws {
        guard Set(ids).isSubset(of: Set(session.project.storedCaptions.map(\.id))) else {
            throw AppActionError("A requested caption no longer exists.")
        }
    }

    private func registerCaptionAdd() {
        register(CaptionAddInput.self, availability: { session in
            session.project.clips.isEmpty ? .init(reason: "Add video before adding captions.") : .available
        }) { session, input in
            var created: ProjectCaption?
            if let after = input.afterCaptionID {
                try Self.requireCaptions([after], in: session)
                session.updateProject { created = $0.addCaption(after: after) }
            } else if let at = input.at {
                let time = try TimelineCue.resolve(at, project: session.project, playhead: session.currentTime)
                session.updateProject { created = $0.addCaption(atTimelineTime: time) }
            } else {
                throw AppActionError("Say where the caption goes: a timeline anchor or the caption it follows.")
            }
            guard let created else { throw AppActionError("No spoken footage there to caption.") }
            if let text = input.text { session.updateProject { $0.setCaptionText(text, for: created.id) } }
            session.setSelectedCaptionIDs([created.id])
            let label = input.text ?? session.captionTexts[created.id] ?? ""
            return AppActionMutation(message: "Caption added" + (label.isEmpty ? "" : " · “\(label.prefix(40))”"),
                changes: [.init(targetID: created.id, property: "added", before: "none", after: "caption")])
        }
    }

    private func registerCaptionRemove() {
        register(CaptionRemoveInput.self, availability: Self.captionAvailability) { session, input in
            try Self.requireCaptions(input.captionIDs, in: session)
            let locked = Set(session.project.storedCaptions.filter(\.locked).map(\.id))
            let removable = input.captionIDs.filter { !locked.contains($0) }
            session.updateProject { project in for id in removable { project.removeCaption(id) } }
            session.setSelectedCaptionIDs(session.selectedCaptionIDs.subtracting(removable))
            let skipped = input.captionIDs.filter { locked.contains($0) }
            return AppActionMutation(
                message: removable.isEmpty ? "Those captions are locked." : "Removed \(removable.count) caption\(removable.count == 1 ? "" : "s")"
                    + (skipped.isEmpty ? "" : " · \(skipped.count) locked skipped"),
                changes: removable.map { .init(targetID: $0, property: "removed", before: "caption", after: "none") },
                skippedIDs: skipped)
        }
    }

    private func registerCaptionMerge() {
        register(CaptionMergeInput.self, availability: Self.captionAvailability) { session, input in
            try Self.requireCaptions(input.captionIDs, in: session)
            let ids = Set(input.captionIDs)
            if let locked = session.project.storedCaptions.first(where: { ids.contains($0.id) && $0.locked }) {
                throw AppActionError("Caption \(locked.id.uuidString) is locked; unlock it before merging.")
            }
            let before = session.captions
            session.updateProject { $0.mergeCaptions(ids) }
            let after = session.captions
            let survivor = after.first { ids.contains($0.id) }
            let survivors = Set(after.map(\.id))
            let gone = before.filter { ids.contains($0.id) && !survivors.contains($0.id) }
            session.setSelectedCaptionIDs(Set([survivor?.id].compactMap { $0 }))
            let changes = gone.map { AppActionChange(targetID: $0.id, property: "mergedInto", before: "caption", after: survivor?.id.uuidString ?? "none") }
            return AppActionMutation(message: changes.isEmpty ? "Those captions could not be merged." : "Merged \(ids.count) captions",
                                     changes: changes)
        }
    }

    private func registerCaptionText() {
        register(CaptionTextInput.self, availability: Self.captionAvailability) { session, input in
            try Self.requireCaptions([input.captionID], in: session)
            guard let caption = session.project.storedCaptions.first(where: { $0.id == input.captionID }) else {
                throw AppActionError("A requested caption no longer exists.")
            }
            if caption.locked { throw AppActionError("That caption is locked; unlock it before editing its text.") }
            let before = session.captionTexts[input.captionID] ?? caption.text
            guard before != input.text else { return AppActionMutation(message: "That caption already says that.") }
            session.updateProject { $0.setCaptionText(input.text, for: input.captionID) }
            return AppActionMutation(message: "Caption text · “\(input.text.prefix(40))”",
                changes: [.init(targetID: input.captionID, property: "text", before: before, after: input.text)],
                afterCommit: { session.noteCaptionEdit(before: before, after: input.text) })
        }
    }

    private func registerCaptionRetime() {
        register(CaptionRetimeInput.self, availability: Self.captionAvailability) { session, input in
            try Self.requireCaptions([input.captionID], in: session)
            guard input.timelineEnd > input.timelineStart + 0.05 else { throw AppActionError("A caption needs its end after its start.") }
            guard let cue = session.captionCue(input.captionID) else { throw AppActionError("That caption is not on the timeline.") }
            var moved = false
            session.updateProject { moved = $0.retimeCaption(input.captionID, toTimelineStart: input.timelineStart, end: input.timelineEnd) }
            guard moved else { throw AppActionError("A caption cannot be moved onto footage it was not spoken over.") }
            session.setSelectedCaptionIDs([input.captionID])
            return AppActionMutation(message: "Caption moved to \(String(format: "%.2f", input.timelineStart))s",
                changes: [.init(targetID: input.captionID, property: "timelineStart", before: String(cue.timelineStart), after: String(input.timelineStart)),
                          .init(targetID: input.captionID, property: "timelineEnd", before: String(cue.timelineEnd), after: String(input.timelineEnd))]
                    .filter { $0.before != $0.after })
        }
    }
}
