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
