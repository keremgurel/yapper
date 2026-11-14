import Foundation

/// Copy and paste: one item's look onto others, and a copied sound back onto
/// the timeline. The menus and Chirpy both paste through these.
extension AppActionRegistry {
    func registerClipboardActions() {
        registerPropertiesPaste()
        registerAudioPaste()
    }

    private func registerPropertiesPaste() {
        register(PropertiesPasteInput.self, availability: { _ in .available }) { session, input in
            if let source = input.fromItemID {
                guard let item = session.timelineItem(for: source), session.copyProperties(of: item) else {
                    throw AppActionError("Choose a caption, text layer, overlay or clip to copy the look of.")
                }
            }
            guard let copied = session.copiedProperties else { throw AppActionError("Copy an item's properties first.") }
            let items = try input.itemIDs.map { id -> TimelineSelectionItem in
                guard let item = session.timelineItem(for: id), copied.matches(item) else {
                    throw AppActionError("Paste a \(copied.noun)'s properties onto \(copied.noun)s only.")
                }
                return item
            }
            let before = session.project
            session.applyCopiedProperties(copied, to: Set(items.map(\.id)))
            var changes: [AppActionChange] = []
            for item in items {
                changes += try Self.lookChanges(of: item, before: before, after: session.project)
            }
            guard !changes.isEmpty else { return AppActionMutation(message: "Those items already look like that.") }
            session.updateProject { $0.updatedAt = Date() }
            return AppActionMutation(message: "Properties pasted onto \(items.count) \(copied.noun)\(items.count == 1 ? "" : "s")",
                                     changes: changes)
        }
    }

    private static func lookChanges(of item: TimelineSelectionItem, before: EditorProject, after: EditorProject) throws -> [AppActionChange] {
        switch item {
        case let .caption(id):
            try PropertyChanges.diff(targetID: id, before: before.caption(withID: id)?.resolvedStyle(base: before.captionStyleOrDefault),
                                     after: after.caption(withID: id)?.resolvedStyle(base: after.captionStyleOrDefault), prefix: "style")
        case let .text(id):
            try PropertyChanges.diff(targetID: id, before: before.textLayers?.first { $0.id == id },
                                     after: after.textLayers?.first { $0.id == id })
        case let .overlay(id):
            try PropertyChanges.diff(targetID: id, before: before.overlays?.first { $0.id == id },
                                     after: after.overlays?.first { $0.id == id }, prefix: "overlay")
        case let .clip(id):
            try PropertyChanges.diff(targetID: id, before: before.clips.first { $0.id == id }, after: after.clips.first { $0.id == id })
        case .audio:
            []
        }
    }

    private func registerAudioPaste() {
        register(AudioPasteInput.self, availability: { session in
            session.duration > 0 ? .available : .init(reason: "Add video before pasting a sound.")
        }) { session, input in
            guard let copy = session.copiedTimelineAudio() else {
                throw AppActionError("Copy a sound on this project's timeline first.")
            }
            let time = try TimelineCue.resolve(input.at, project: session.project, playhead: session.currentTime)
            var layer = copy.layer
            layer.id = UUID()
            layer.timelineStart = min(max(0, time), max(0, session.duration - 0.02))
            layer.duration = min(layer.duration, session.duration - layer.timelineStart)
            session.updateProject { project in
                project.audioLayers = (project.audioLayers ?? []) + [layer]
            }
            return AppActionMutation(message: "Pasted \(layer.name) · ⌘Z to undo",
                changes: [.init(targetID: layer.id, property: "audio", before: "none", after: layer.name)],
                afterCommit: { session.selectAudioLayer(layer.id) })
        }
    }
}
