import SwiftUI

/// A toolbar label that stays legible as its panel narrows.
///
/// Text is never squeezed into an ambiguous fragment. SwiftUI tries the full
/// label, then an optional shorter label, and finally the icon. Callers still
/// provide `.help(...)` on the control so the icon-only state is discoverable
/// with a pointer as well as VoiceOver.
struct AdaptiveControlLabel: View {
    let title: String
    let systemImage: String
    var compactTitle: String?

    var body: some View {
        ViewThatFits(in: .horizontal) {
            Label(title, systemImage: systemImage)
                .fixedSize(horizontal: true, vertical: false)

            if let compactTitle {
                Label(compactTitle, systemImage: systemImage)
                    .fixedSize(horizontal: true, vertical: false)
            }

            Image(systemName: systemImage)
                .accessibilityHidden(true)
                .frame(minWidth: 14)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
    }
}
