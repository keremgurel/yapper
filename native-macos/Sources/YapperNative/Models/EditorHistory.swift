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
}
