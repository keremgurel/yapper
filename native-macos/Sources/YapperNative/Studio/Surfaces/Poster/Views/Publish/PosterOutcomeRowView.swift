import SwiftUI

/// One destination in the outcome list: its name and anything left to do on
/// the left, and on the right a spinner while it goes out, then the result.
struct PosterOutcomeRowView: View {
    let row: PosterOutcomeRow
    /// Whether a result landing now draws its check.
    var animated = true

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(row.platform.label).font(.studioBodyStrong)
                ForEach(row.notes, id: \.self) { note in
                    Text(note).font(.studioLabel).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 12)
            result.frame(minHeight: 16).fixedSize()
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
    }

    private var result: some View {
        HStack(spacing: 6) {
            switch row.result {
            case .sending:
                ProgressView().controlSize(.mini)
                Text("Publishing…").font(.studioLabel).foregroundStyle(.secondary)
            case let .link(title, url):
                if row.isPosted { PosterDrawnCheck(animated: animated) }
                Link(destination: url) {
                    HStack(spacing: 3) {
                        Text(title)
                        Image(systemName: "arrow.up.right").imageScale(.small).accessibilityHidden(true)
                    }
                }
                .font(.studioLabelStrong)
                .clickableCursor()
                .accessibilityLabel("\(title) on \(row.platform.label)")
            case let .status(label):
                if row.isPosted { PosterDrawnCheck(animated: animated) }
                Text(label).font(.studioLabelStrong).foregroundStyle(statusColor)
            }
        }
    }

    private var statusColor: Color {
        switch row.outcome?.status {
        case .failed: .studioDanger
        case .pending: .secondary
        default: .primary
        }
    }
}
