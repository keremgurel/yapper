import Foundation

/// Copy one item's look, paste it onto the rest.
///
/// The pasting end reads the selection, so a look copied from one caption lands
/// on every caption picked out with a marquee or a shift-click. Pasting onto an
/// item that is not part of the selection lands on that item alone, which is
/// the same rule dragging follows.
extension EditorSession {
    func copyProperties(of item: TimelineSelectionItem) {
        guard let copied = properties(of: item) else { return }
        copiedProperties = copied
        setStatus("Copied \(copied.noun) properties")
    }

    /// What the paste item should say, or nil when there is nothing of this
    /// kind to paste and the item does not belong on the menu at all.
    func pastePropertiesTitle(for item: TimelineSelectionItem) -> String? {
        guard let copied = copiedProperties, copied.matches(item) else { return nil }
        let count = propertyPasteTargets(for: item).count
        guard count > 0 else { return nil }
        return count == 1
            ? "Paste properties"
            : "Paste properties onto \(count) \(copied.noun)s"
    }

    func pasteProperties(onto item: TimelineSelectionItem) {
        guard let copied = copiedProperties, copied.matches(item) else { return }
        let targets = propertyPasteTargets(for: item)
        guard !targets.isEmpty else { return }
        let said = "Properties pasted onto \(targets.count) \(copied.noun)\(targets.count == 1 ? "" : "s")"

        switch copied {
        case let .caption(style):
            scheduleVisualCommit(successStatus: said) { [self] in
                updateProject {
                    $0.applyCaptionStyle(
                        .everything(in: style),
                        applyToAll: false,
                        selection: targets
                    )
                }
                return true
            }
        case let .text(style):
            scheduleVisualCommit(successStatus: said) { [self] in
                updateProject { project in
                    project.textLayers = (project.textLayers ?? []).map { layer in
                        guard targets.contains(layer.id) else { return layer }
                        var copy = layer
                        copy.apply(.everything(in: style))
                        return copy
                    }
                    project.updatedAt = Date()
                }
                return true
            }
        case let .cutaway(look):
            scheduleCompositionCommit(successStatus: said) { [self] in
                updateProject { project in
                    project.overlays = (project.overlays ?? []).map { overlay in
                        targets.contains(overlay.id) ? look.applied(to: overlay) : overlay
                    }
                    project.updatedAt = Date()
                }
                return true
            }
        case let .clip(look):
            scheduleCompositionCommit(successStatus: said) { [self] in
                updateProject { project in
                    project.clips = project.clips.map { clip in
                        targets.contains(clip.id) ? look.applied(to: clip) : clip
                    }
                    project.updatedAt = Date()
                }
                return true
            }
        }
    }

    // MARK: - Reading

    private func properties(of item: TimelineSelectionItem) -> CopiedProperties? {
        switch item {
        case let .caption(id):
            guard let caption = project.caption(withID: id) else { return nil }
            return .caption(caption.resolvedStyle(base: project.captionStyleOrDefault))
        case let .text(id):
            guard let layer = project.textLayers?.first(where: { $0.id == id }) else { return nil }
            return .text(
                TextStyle(
                    x: layer.x,
                    y: layer.y,
                    width: layer.width,
                    rotation: layer.rotation,
                    appearance: layer.appearance
                )
            )
        case let .overlay(id):
            guard let overlay = overlays.first(where: { $0.id == id }) else { return nil }
            return .cutaway(.of(overlay))
        case let .clip(id):
            guard let clip = project.clips.first(where: { $0.id == id }) else { return nil }
            return .clip(.of(clip))
        case .audio:
            return nil
        }
    }

    /// The items a paste lands on: everything of this kind that is selected,
    /// when the item pasted onto is one of them, and otherwise that item alone.
    private func propertyPasteTargets(for item: TimelineSelectionItem) -> Set<UUID> {
        let selected: Set<UUID> = switch item {
        case .caption: selectedCaptionIDs
        case .clip: selectedClipIDs
        case .overlay: selectedOverlayIDs
        case .text: selectedTextLayerIDs
        case .audio: []
        }
        guard selected.contains(item.id) else { return [item.id] }
        return selected
    }
}

extension CopiedProperties {
    /// Whether this look belongs on that item. A caption's look means nothing
    /// to a cutaway, so the menu does not offer it.
    func matches(_ item: TimelineSelectionItem) -> Bool {
        switch (self, item) {
        case (.caption, .caption), (.text, .text), (.cutaway, .overlay), (.clip, .clip): true
        default: false
        }
    }
}
