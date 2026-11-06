import Foundation

/// What the overlay workflow tells the creator when nothing landed.
enum OverlayWorkflowOutcome {
    /// Why a run left the project untouched: the notes it gathered on the way
    /// (a design that failed, a quote that did not match, the editor deciding
    /// no moment needed a visual), or a plain line when it gathered none.
    static func nothingChanged(_ status: OverlayPlacementStatus) -> String {
        let notes: [String]
        switch status {
        case let .placed(found), let .generated(found, _): notes = found
        case .idle, .working, .failed: notes = []
        }
        let reasons = notes.filter { !$0.isEmpty }
        return reasons.isEmpty ? "No overlay was added." : "No overlay was added. " + reasons.joined(separator: " ")
    }

    /// One line for each named file that did not land, saying where it was
    /// lost: never chosen, quoted words not found, or turned away on arrival.
    static func unplaced(_ files: [ProjectMedia], planned: Set<String>, matched: Set<String>,
                         landed: Set<UUID>) -> [String] {
        files.filter { !landed.contains($0.id) }.map { file in
            let why = !planned.contains(file.name) ? "no moment was chosen for it"
                : !matched.contains(file.name) ? "its words were not found in the kept speech"
                : "that moment already had it, or overlapped another placement"
            return "Not placed: \(file.name), because \(why)."
        }
    }

    /// One visual the designer could not make, with the server's reason.
    static func skippedDesign(name: String, reason: String?) -> String {
        guard let reason, !reason.isEmpty else { return "Couldn’t generate \(name); it was skipped." }
        return "Couldn’t generate \(name): \(why(reason))."
    }

    private static func why(_ code: String) -> String {
        switch code {
        case "answer_truncated": "the designer ran out of room before finishing it"
        case "layout_quality_failed": "every draft failed the layout check"
        case "timeout": "the designer took too long"
        default: YapperAPI.readable(code)
        }
    }
}
