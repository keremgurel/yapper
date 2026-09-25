import Foundation

/// The idea open on screen, as far as the floating Chirpy is concerned.
///
/// The floating assistant is app-wide and used to answer with nothing but the
/// tab's name, so "our script is terrible compared to the inspiration" came
/// back as generic advice and a request to paste the script. While an idea's
/// canvas is open, its ask runner is here, and the floating assistant sends
/// the message to it: the same Chirpy as the canvas's own ask bar, with the
/// script, hooks, note and source in hand, able to change the page.
@MainActor
final class IdeaCanvasFocus {
    static let shared = IdeaCanvasFocus()

    private(set) weak var runner: IdeaCanvasAskRunner?

    func attach(_ runner: IdeaCanvasAskRunner) { self.runner = runner }

    func detach(_ runner: IdeaCanvasAskRunner) {
        if self.runner === runner { self.runner = nil }
    }
}
