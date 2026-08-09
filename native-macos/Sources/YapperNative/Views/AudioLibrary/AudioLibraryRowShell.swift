import SwiftUI

/// How every row on the library page is drawn.
///
/// The creator's own files and the shipped effects sit on the same page and
/// have to read as one library, so the icon, the play button, the two lines of
/// text and the hover treatment live here once. What differs between them is
/// only what sits at the end of the row, which is the caller's to fill in.
struct AudioLibraryRowShell<Title: View, Trailing: View>: View {
    let subtitle: String
    var subtitleTint: Color = .secondary
    let isPlaying: Bool
    var playDisabled = false
    let onToggle: () -> Void
    @ViewBuilder let title: () -> Title
    /// Given whether the pointer is over the row, so a secondary action can
    /// fade in rather than sit on every row at full strength.
    @ViewBuilder let trailing: (Bool) -> Trailing

    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 10) {
            playButton

            VStack(alignment: .leading, spacing: 2) {
                title()
                Text(subtitle)
                    .font(.studioCaption)
                    .foregroundStyle(subtitleTint)
            }

            Spacer(minLength: 8)

            trailing(isHovering)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(isHovering ? Color.studioFaintFill : Color.raisedBackground)
                .overlay {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .strokeBorder(
                            isPlaying ? Color.yapperOrange.opacity(0.7) : Color.studioLine,
                            lineWidth: 1
                        )
                }
        }
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.12), value: isHovering)
    }

    private var playButton: some View {
        Button(action: onToggle) {
            Image(systemName: isPlaying ? "stop.fill" : "play.fill")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(isPlaying ? Color.white : Color.primary)
                .frame(width: 28, height: 28)
                .background {
                    Circle().fill(isPlaying ? Color.yapperOrange : Color.studioRaisedChip)
                }
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .disabled(playDisabled)
        .help(isPlaying ? "Stop" : "Play")
    }
}
