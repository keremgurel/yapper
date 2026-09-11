import Foundation

extension EditorProject {
    /// Locks protect the edit itself. Magnetic shifts caused by earlier clips
    /// are allowed; deleting, trimming, speeding up or replacing a lock is not.
    func validateLocks(since previous: EditorProject) throws {
        guard id == previous.id else { return }
        for original in previous.clips where original.locked {
            guard var current = clips.first(where: { $0.id == original.id }) else {
                throw NativeEditorError.aiFailed("Unlock the protected clip before deleting or replacing it.")
            }
            current.isLocked = original.isLocked
            guard current == original else {
                throw NativeEditorError.aiFailed("Unlock the protected clip before changing it.")
            }
            let common = Set(previous.clips.map(\.id)).intersection(clips.map(\.id))
            let oldBefore = Set(previous.clips.prefix { $0.id != original.id }.map(\.id)).intersection(common)
            let newBefore = Set(clips.prefix { $0.id != original.id }.map(\.id)).intersection(common)
            guard oldBefore == newBefore else {
                throw NativeEditorError.aiFailed("Unlock the protected clip before reordering across it.")
            }
        }
        let protected = (previous.captions ?? []).filter(\.locked)
        guard !protected.isEmpty else { return }
        let oldCues = previous.captionCues
        let newCues = captionCues
        for original in protected {
            guard var current = captions?.first(where: { $0.id == original.id }) else {
                throw NativeEditorError.aiFailed("Unlock the protected captions before deleting or regenerating them.")
            }
            current.isLocked = original.isLocked
            current.lockedText = original.lockedText
            current.lockedStyle = original.lockedStyle
            guard current == original else {
                throw NativeEditorError.aiFailed("Unlock the protected caption before changing it.")
            }
            // Cutting the words out must not make a locked caption vanish.
            if oldCues.contains(where: { $0.id == original.id }), !newCues.contains(where: { $0.id == original.id }) {
                throw NativeEditorError.aiFailed("This edit would remove a protected caption. Unlock it first.")
            }
        }
    }

    mutating func setLocked(_ locked: Bool, items: Set<TimelineSelectionItem>) {
        let captionIDs = Set(items.compactMap { item -> UUID? in
            if case let .caption(id) = item { return id }; return nil
        })
        if !captionIDs.isEmpty { ensureCaptionsMaterialized() }
        let texts = captionTextsByID
        let baseStyle = captionStyleOrDefault
        for index in clips.indices where items.contains(.clip(clips[index].id)) {
            clips[index].isLocked = locked ? true : nil
        }
        for index in captions?.indices ?? 0..<0 where captionIDs.contains(captions![index].id) {
            guard let caption = captions?[index], caption.locked != locked else { continue }
            captions?[index].lockedText = locked ? (texts[caption.id] ?? caption.text) : nil
            captions?[index].lockedStyle = locked ? caption.resolvedStyle(base: baseStyle) : nil
            captions?[index].isLocked = locked ? true : nil
        }
    }
}
