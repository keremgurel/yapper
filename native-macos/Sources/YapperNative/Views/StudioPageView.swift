import SwiftUI

struct StudioPageView: View {
    let destination: StudioDestination
    let onNavigate: (StudioDestination) -> Void
    @AppStorage("studioColorScheme") private var themeRaw = StudioTheme.dark.rawValue

    var body: some View {
        CloudStudioView(
            destination: destination,
            theme: StudioTheme(rawValue: themeRaw) ?? .dark,
            onNavigate: onNavigate
        )
    }
}
