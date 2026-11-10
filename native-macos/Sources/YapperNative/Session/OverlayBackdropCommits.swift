import Foundation

/// Runs backdrop changes one at a time, the last click winning.
///
/// Each change is an app action, and an action that starts while the one
/// before it is still landing is refused because the project changed under
/// it. Clicking through the swatches to compare them did exactly that: every
/// other click was dropped and the picker ended on a look nobody chose last.
@MainActor
final class OverlayBackdropCommits {
    static let shared = OverlayBackdropCommits()

    private var pending: (session: EditorSession, overlayID: UUID, backdrop: OverlayBackdrop?)?
    private var running = false

    func request(_ backdrop: OverlayBackdrop?, for overlayID: UUID, in session: EditorSession) {
        pending = (session, overlayID, backdrop)
        guard !running else { return }
        running = true
        Task {
            while let next = pending {
                pending = nil
                await next.session.performAppAction(OverlayPropertiesInput(
                    overlayIDs: [next.overlayID], all: nil, hidden: nil, behindSpeaker: nil,
                    backdrop: next.backdrop?.token ?? "none", sourceStart: nil,
                    timelineStart: nil, duration: nil, track: nil
                ))
            }
            running = false
        }
    }
}
