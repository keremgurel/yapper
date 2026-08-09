import Foundation

/// Things the native chrome needs the web session to do.
///
/// The account lives with Clerk, in the web view's cookies, so signing out is
/// not something the app can do to itself: clearing the jar locally would leave
/// the session alive on the server and log the creator out of nothing. The
/// native menu raises a request here, the web view carries it out, and Clerk
/// stays the only thing that decides who is signed in.
///
/// A counter rather than a flag, so two sign-outs in a row are two requests.
@MainActor
final class StudioWebCommands: ObservableObject {
    static let shared = StudioWebCommands()

    @Published private(set) var signOutGeneration = 0
    @Published private(set) var manageAccountGeneration = 0

    func signOut() { signOutGeneration += 1 }
    func manageAccount() { manageAccountGeneration += 1 }
}
