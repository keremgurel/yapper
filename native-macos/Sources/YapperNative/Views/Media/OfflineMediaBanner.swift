import SwiftUI

/// Says why the picture is missing, and offers the way back.
///
/// Over the preview because that is where the symptom is. A file that has gone
/// offline shows up as a black frame and nothing else: no error, no warning,
/// and every control still working on an edit whose footage nobody can read.
/// The creator's own guess was that the app had broken.
///
/// Nothing here is destructive. The edit is intact behind this; the only thing
/// missing is the file, and both ways back — plugging the drive in, or pointing
/// at where the file went — leave every cut where it was.
struct OfflineMediaBanner: View {
    @ObservedObject var session: EditorSession
    /// Watched directly, so a card going in or coming out redraws this and
    /// nothing else in the editor.
    @ObservedObject var availability: MediaAvailabilityWatcher

    var body: some View {
        if let summary = session.offlineMediaSummary, let first = availability.offline.first {
            VStack(spacing: 10) {
                Image(systemName: "externaldrive.badge.questionmark")
                    .font(.system(size: 26, weight: .light))
                    .foregroundStyle(Color.yapperOrange)

                Text("Media offline")
                    .font(.system(size: 14, weight: .bold))

                Text(summary)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Your edit is safe. Reconnect the drive and it picks up by itself.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                Button("Locate \(first.name)…") {
                    RelinkPanel.locate(first, for: session)
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .regular))
                .help("Point the project at where the file is now")
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 18)
            .frame(maxWidth: 340)
            .studioGlassBackground(radius: 12)
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.yapperOrange.opacity(0.32), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.45), radius: 18, y: 8)
        }
    }
}
