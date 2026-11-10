import SwiftUI

/// One sound you can hear first and then place at the playhead. The shipped
/// effects and your saved sounds share it, so the two shelves read as one
/// library.
///
/// Add is the card's one primary action and the only filled button on it.
/// Preview is a quiet icon that turns into a stop while it plays.
struct AudioItemCard: View {
    let icon: String
    let title: String
    let detail: String
    let disabled: Bool
    let isPlaying: Bool
    let preview: () -> Void
    let add: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            AudioIconTile(systemName: icon)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.studioBodyStrong)
                    .lineLimit(1)
                Text(detail)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .help("\(title): \(detail)")

            Spacer(minLength: 4)

            Button(action: preview) {
                Image(systemName: isPlaying ? "stop.fill" : "play.fill")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(isPlaying ? Color.yapperOrange : Color.secondary)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(EditorGhostButtonStyle(size: .mini))
            .accessibilityLabel(isPlaying ? "Stop \(title)" : "Preview \(title)")
            .help(isPlaying ? "Stop" : "Preview \(title)")

            Button(action: add) {
                Image(systemName: "plus")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(disabled ? Color.secondary : Color.white)
                    .frame(width: 28, height: 28)
                    .background(disabled ? Color.studioFaintFill : Color.yapperOrange)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            }
            .buttonStyle(.studioPlain)
            .disabled(disabled)
            .accessibilityLabel("Add \(title) at playhead")
            .help("Add \(title) at playhead")
        }
        .padding(.leading, 10)
        .padding(.trailing, 12)
        .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
        .background(Color.raisedBackground)
        .overlay {
            RoundedRectangle(cornerRadius: AudioWorkbenchMetrics.cardRadius, style: .continuous)
                .stroke(isPlaying ? Color.yapperOrange.opacity(0.5) : Color.studioLine, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: AudioWorkbenchMetrics.cardRadius, style: .continuous))
    }
}

/// The square an audio row's icon sits in. One size across the tab.
struct AudioIconTile: View {
    let systemName: String

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.yapperOrange)
            .frame(width: 30, height: 30)
            .background(Color.yapperOrange.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            .accessibilityHidden(true)
    }
}
