import SwiftUI

/// Where native Studio pages send the creator inside Studio: another tab, or
/// one idea's canvas. Pages read it from the environment instead of reaching
/// for the shell.
@MainActor
final class StudioNavigation: ObservableObject {
    static let shared = StudioNavigation()

    /// The idea whose canvas is open over the Ideas tab, if any.
    @Published var openIdeaID: String?

    /// Set by the shell; moves to another tab.
    var goTo: (StudioDestination) -> Void = { _ in }

    func openIdea(_ id: String) {
        openIdeaID = id
        goTo(.ideas)
    }
}
