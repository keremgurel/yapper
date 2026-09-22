import SwiftUI

/// Which Studio tabs the app draws itself. A tab moves here when its SwiftUI
/// page is finished; until then it keeps loading the web route, so every tab
/// works at every step of the move.
enum NativeSurfaces {
    static let enabled: Set<StudioDestination> = [.connections]
}

/// Shows the native page for a destination that has one.
struct NativeSurfaceHost: View {
    let destination: StudioDestination
    let session: EditorSession
    let navigate: (StudioDestination) -> Void

    var body: some View {
        switch destination {
        case .connections:
            ConnectionsPage()
        default:
            EmptyView()
        }
    }
}
