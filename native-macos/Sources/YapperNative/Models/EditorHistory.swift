import Foundation

/// Snapshot history for edits that change the exported project. Playback,
/// selection, zoom, and other transient UI state deliberately stay outside it.
struct EditorHistory: Sendable {
    private(set) var undoStack: [EditorProject] = []
    private(set) var redoStack: [EditorProject] = []
    let limit: Int

    init(limit: Int = 100) {
        self.limit = max(1, limit)
    }

    var canUndo: Bool { !undoStack.isEmpty }
    var canRedo: Bool { !redoStack.isEmpty }

    mutating func record(before snapshot: EditorProject, after current: EditorProject) {
        guard snapshot != current else { return }
        if undoStack.last != snapshot {
            undoStack.append(snapshot)
            if undoStack.count > limit {
                undoStack.removeFirst(undoStack.count - limit)
            }
        }
        redoStack.removeAll(keepingCapacity: true)
    }

    mutating func undo(current: EditorProject) -> EditorProject? {
        guard let snapshot = undoStack.popLast() else { return nil }
        redoStack.append(current)
        if redoStack.count > limit {
            redoStack.removeFirst(redoStack.count - limit)
        }
        return snapshot
    }

    mutating func redo(current: EditorProject) -> EditorProject? {
        guard let snapshot = redoStack.popLast() else { return nil }
        undoStack.append(current)
        if undoStack.count > limit {
            undoStack.removeFirst(undoStack.count - limit)
        }
        return snapshot
    }

    mutating func clear() {
        undoStack.removeAll(keepingCapacity: true)
        redoStack.removeAll(keepingCapacity: true)
    }

    /// Recovery changes where an identity lives, not the edit itself. Carry
    /// that new location through both stacks so older creative edits remain
    /// undoable without resurrecting an offline path.
    mutating func rewriteMedia(_ replacements: [UUID: ProjectMedia]) {
        guard !replacements.isEmpty else { return }
        func rewritten(_ snapshot: EditorProject) -> EditorProject {
            var result = snapshot
            for index in result.media.indices {
                if let replacement = replacements[result.media[index].id] {
                    result.media[index] = replacement
                }
            }
            return result
        }
        undoStack = undoStack.map(rewritten)
        redoStack = redoStack.map(rewritten)
    }

    mutating func rewriteAudio(_ replacement: ProjectAudioLayer) {
        func rewritten(_ snapshot: EditorProject) -> EditorProject {
            var result = snapshot
            guard let index = result.audioLayers?.firstIndex(where: { $0.id == replacement.id }) else { return result }
            result.audioLayers?[index].url = replacement.url
            result.audioLayers?[index].name = replacement.name
            result.audioLayers?[index].sourceDuration = replacement.sourceDuration
            result.audioLayers?[index].builtInID = replacement.builtInID
            result.audioLayers?[index].sourceKind = replacement.sourceKind
            result.audioLayers?[index].sourceFingerprint = replacement.sourceFingerprint
            result.audioLayers?[index].savedAudioID = replacement.savedAudioID
            result.audioLayers?[index].savedAudioHash = replacement.savedAudioHash
            return result
        }
        undoStack = undoStack.map(rewritten)
        redoStack = redoStack.map(rewritten)
    }

    func requiredAudioSourceEnd(for id: UUID) -> Double {
        (undoStack + redoStack).compactMap { snapshot in
            snapshot.audioLayers?.first(where: { $0.id == id }).map { $0.sourceStart + $0.duration }
        }.max() ?? 0
    }

    func referencesSavedAudio(_ item: SavedAudio, url: URL) -> Bool {
        (undoStack + redoStack).contains { snapshot in
            snapshot.audioLayers?.contains(where: {
                $0.savedAudioID == item.id ||
                    $0.savedAudioHash == item.contentHash ||
                    $0.url.resolvingSymlinksInPath() == url
            }) == true
        }
    }
}
