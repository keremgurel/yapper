import Foundation

/// What the app's one web view is actually showing.
///
/// Deliberately not `@State` on the view. The shell's chrome appears and
/// disappears with the signed-in state, which changes the structure of the view
/// tree around the web view, and SwiftUI answers a structural change by giving
/// the subtree a new identity: fresh `@State`, and a coordinator still writing
/// into the binding of the old one. The cover that hides a stale page then had
/// no way to be told the page had arrived, so it stayed up over a working page
/// and swallowed every click.
///
/// There is exactly one web view in the app, so one place to keep this.
@MainActor
final class StudioWebPresentation: ObservableObject {
    static let shared = StudioWebPresentation()

    /// The path of the page on screen, as the page itself reported it.
    @Published var shownPath: String?
}
