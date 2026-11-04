import Foundation

/// What the panel header says while Chirpy works.
///
/// A long design runs through several stages, and the editor's status line
/// names each one ("Designing 2 of 3…"). The header used to say "Working on
/// it…" for the whole minute, which reads as stuck; it now says what the
/// status line says, falling back to the generic line when that has nothing.
enum AssistantWorkingLine {
    static let fallback = "Working on it…"

    static func text(status: String) -> String {
        let trimmed = status.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty || trimmed == "Ready" ? fallback : trimmed
    }
}
