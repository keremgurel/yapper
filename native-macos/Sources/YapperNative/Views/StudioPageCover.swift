import SwiftUI

/// What sits over a web tab until the page it is on is the page that was asked
/// for.
///
/// Deliberately not a spinner on an empty field. Switching tabs used to show
/// the previous page under the new tab's name, which reads as the app being
/// wrong rather than the app being busy. This says which page is coming, in the
/// window's own colours, so the wait looks like the app working instead of the
/// app glitching.
struct StudioPageCover: View {
    let destination: StudioDestination

    @State private var isBreathing = false

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: destination.systemImage)
                .font(.system(size: 26, weight: .light))
                .foregroundStyle(Color.yapperOrange)
                .opacity(isBreathing ? 1 : 0.45)
                .animation(
                    .easeInOut(duration: 0.9).repeatForever(autoreverses: true),
                    value: isBreathing
                )

            Text(destination.title)
                .font(.studioSectionTitle)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.editorBackground)
        .onAppear { isBreathing = true }
        .accessibilityLabel("Loading \(destination.title)")
    }
}
