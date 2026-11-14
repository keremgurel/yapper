import Foundation

/// What a finished move says on the Storage page.
enum ProjectMoveSummary {
    static func sentence(moved: [ProjectMover.Moved], failures: [String], folder: URL) -> String {
        var parts: [String] = []
        if !moved.isEmpty {
            let count = moved.count == 1 ? "1 project" : "\(moved.count) projects"
            parts.append("Moved \(count) to “\(folder.lastPathComponent)”.")
        }
        if moved.contains(where: \.originalInTrash) {
            parts.append("The originals are in the Trash. Keep them there until you’ve opened the moved projects.")
        }
        if moved.contains(where: \.originalKept) {
            parts.append("Some originals couldn’t go to the Trash, so they’re still in the old folder.")
        }
        if !failures.isEmpty {
            parts.append("Not moved, still in the old folder: " + failures.joined(separator: " "))
        }
        return parts.joined(separator: " ")
    }
}
