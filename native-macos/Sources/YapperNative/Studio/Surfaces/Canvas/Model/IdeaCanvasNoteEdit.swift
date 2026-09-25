import Foundation

/// An edit to the creator's own note. Words added to a bare link make the
/// idea semi-original, and clearing them makes it inspiration again, the
/// same rule the composer applies when an idea is captured.
enum IdeaCanvasNoteEdit {
    static func patch(note: String, ideaType: String?) -> IdeaCanvasPatch {
        let hasWords = !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let nextType: String? = switch ideaType {
        case "inspiration" where hasWords: "semi-original"
        case "semi-original" where !hasWords: "inspiration"
        default: nil
        }
        return IdeaCanvasPatch(originalNote: note, ideaType: nextType)
    }
}
