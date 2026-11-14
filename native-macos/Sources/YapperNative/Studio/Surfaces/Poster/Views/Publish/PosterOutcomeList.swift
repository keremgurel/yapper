import SwiftUI

/// What is going out and what happened, one line per destination under a
/// headline. Every destination is listed from the moment the press starts,
/// so it is plain they go out together, and a failure stays beside the
/// successes.
struct PosterOutcomeList: View {
    let rows: [PosterOutcomeRow]
    /// True once a destination was seen going out. Only a result that lands
    /// while the list is on screen draws its check; one that was already
    /// there when the list appeared is shown finished.
    @State private var sawSending = false

    var body: some View {
        if let headline = PosterOutcomeHeadline(rows: rows) {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    mark(headline.mark).frame(width: 18, height: 18)
                    Text(headline.text).font(.studioSectionTitle)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 12).padding(.vertical, 12)
                .accessibilityElement(children: .combine)
                ForEach(rows) { row in
                    Rectangle().fill(Color.studioLine).frame(height: 1)
                    PosterOutcomeRowView(row: row, animated: sawSending)
                }
            }
            .background(NativeCardBackground(radius: StudioRadius.panel))
            .onAppear { noteSending(rows) }
            .onChange(of: rows) { _, rows in noteSending(rows) }
            .onChange(of: headline) { _, headline in
                // The result is announced, since the drawn check says nothing to VoiceOver.
                if headline.mark != .sending { AccessibilityNotification.Announcement(headline.text).post() }
            }
        }
    }

    @ViewBuilder private func mark(_ mark: PosterOutcomeHeadline.Mark) -> some View {
        switch mark {
        case .sending: ProgressView().controlSize(.small)
        case .done: PosterDrawnCheck(size: 18, animated: sawSending)
        case .waiting: Image(systemName: "clock").font(.studioBody).foregroundStyle(.secondary)
        case .failed: Image(systemName: "exclamationmark.circle").font(.studioBody).foregroundStyle(Color.studioDanger)
        }
    }

    private func noteSending(_ rows: [PosterOutcomeRow]) {
        if rows.contains(where: \.isSending) { sawSending = true }
    }
}
