import SwiftUI

/// What the page says before anything has been saved.
///
/// It has to teach the one thing that is not obvious: this is not the project's
/// audio, it is yours, and it stays here for the next project and the one after
/// that.
struct AudioLibraryEmptyState: View {
    let onImport: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "waveform.badge.plus")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Color.yapperOrange)

            Text("Nothing saved yet")
                .font(.studioSectionTitle)

            Text(
                """
                Drop music, sound effects or voice here and they stay on the \
                shelf, ready to drop into this project and every one after it.
                """
            )
            .font(.studioBody)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: 380)

            Button("Import audio", action: onImport)
                .buttonStyle(EditorPrimaryButtonStyle())
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 54)
    }
}
