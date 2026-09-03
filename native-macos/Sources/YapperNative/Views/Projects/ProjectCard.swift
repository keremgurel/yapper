import SwiftUI

/// One project in the grid: its poster, its name, how long it is and when it
/// was last touched. The card opens it; everything else is in the context menu.
struct ProjectCard: View {
    let listing: ProjectListing
    let isOpen: Bool
    let onOpen: () -> Void
    let onRename: () -> Void
    let onDuplicate: () -> Void
    let onReveal: () -> Void
    let onTrash: () -> Void

    private static let relative: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter
    }()

    private var duration: String {
        let total = Int(listing.summary.duration.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 8) {
                ProjectPosterView(listing: listing)
                    .aspectRatio(9 / 16, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(isOpen ? Color.yapperOrange : Color.studioLine, lineWidth: isOpen ? 2 : 1)
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text(listing.summary.name)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                        .foregroundStyle(.primary)
                    Text("\(duration) · \(Self.relative.localizedString(for: listing.summary.updatedAt, relativeTo: Date()))")
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .padding(.horizontal, 2)
            }
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .contextMenu {
            Button("Open") { onOpen() }
            Button("Rename…") { onRename() }
            Button("Duplicate") { onDuplicate() }
            Divider()
            Button("Show in Finder") { onReveal() }
            Divider()
            Button("Move to Trash", role: .destructive) { onTrash() }
        }
        .accessibilityLabel("\(listing.summary.name), \(duration)")
    }
}
