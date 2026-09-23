import SwiftUI

/// What to work on now: unposted items, dated work first. A row opens that
/// item's canvas.
struct HomeUpNextSection: View {
    let items: [HomeItem]?
    let failed: Bool

    var body: some View {
        NativeSection(title: "Up next") {
            Button("Open Ideas") { StudioNavigation.shared.goTo(.ideas) }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
        } content: {
            content
        }
    }

    @ViewBuilder
    private var content: some View {
        if failed {
            Text("Your Library queue couldn't be loaded. Use Refresh above to try again.")
                .font(.system(size: 13)).foregroundStyle(.secondary)
        } else if let items {
            let queue = HomeRanking.upNext(items)
            if queue.isEmpty {
                NativeEmptyState(
                    systemImage: "film.stack",
                    title: "Nothing queued to shoot",
                    message: "Send an idea to the Library and it will show up here."
                ) {
                    Button("Open Idea Bank") { StudioNavigation.shared.goTo(.ideas) }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                }
            } else {
                HomeDividedList(items: queue) { item in
                    HomeListRow(action: { StudioNavigation.shared.openIdea(item.id) }) {
                        Text(item.displayTitle)
                            .font(.system(size: 13, weight: .medium))
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if item.isDated, let label = HomeUpNextSection.scheduledLabel(item.scheduledFor) {
                            Text(label).font(.system(size: 12).monospacedDigit()).foregroundStyle(.secondary)
                        }
                        NativeChip(text: Self.statusLabel(item.status), tone: Self.statusTone(item.status))
                    }
                }
            }
        } else {
            HomeRowSkeleton()
        }
    }

    static func statusLabel(_ status: String) -> String {
        switch status {
        case "captured": "Captured"
        case "drafting": "Drafting"
        case "ready": "Ready"
        case "posted": "Posted"
        default: status.capitalized
        }
    }

    static func statusTone(_ status: String) -> NativeChip.Tone {
        switch status {
        case "drafting": .cyan
        case "ready": .yellow
        case "posted": .green
        default: .neutral
        }
    }

    static func scheduledLabel(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = precise.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return nil }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }
}
