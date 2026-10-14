import SwiftUI

/// The answer to "what do I work on now": the pipeline at a glance, then the
/// next five ideas, dated work first. A fresh capture lands at the top and
/// says so while Yapper is still shaping it.
struct HomeUpNextSection: View {
    /// Nil while the first load is in flight.
    let items: [IdeaItem]?
    /// Ideas Yapper is still turning into a script.
    let shaping: Set<String>
    let failed: Bool
    let onRetry: () -> Void

    var body: some View {
        NativeSection(title: "Up next") {
            if !(items ?? []).isEmpty {
                Button("All ideas") { StudioNavigation.shared.goTo(.ideas) }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
            }
        } content: {
            content
        }
    }

    @ViewBuilder
    private var content: some View {
        if failed {
            HStack(spacing: 12) {
                Text("Your ideas didn’t load.").font(.system(size: 13)).foregroundStyle(.secondary)
                Button("Try again", action: onRetry).buttonStyle(EditorSecondaryButtonStyle(size: .small))
            }
            .padding(.vertical, 4)
        } else if let items {
            let queue = HomeRanking.upNext(items)
            if queue.isEmpty {
                NativeEmptyState(
                    systemImage: "lightbulb",
                    title: items.isEmpty ? "No ideas yet" : "Everything’s posted",
                    message: items.isEmpty
                        ? "Capture one above. It shows up here with a script started."
                        : "Capture the next one above and it lands here."
                ) { EmptyView() }
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    HomePipelineBar(items: items)
                    HomeDividedList(items: queue) { item in
                        HomeListRow(action: { StudioNavigation.shared.openIdea(item.id) }) {
                            row(item)
                        }
                    }
                }
            }
        } else {
            VStack(spacing: 12) {
                Capsule().fill(Color.studioFaintFill).frame(height: 8)
                HomeRowSkeleton()
            }
        }
    }

    @ViewBuilder
    private func row(_ item: IdeaItem) -> some View {
        Text(item.displayTitle)
            .font(.system(size: 13, weight: .medium))
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
        if shaping.contains(item.id) {
            HStack(spacing: 6) {
                ProgressView().controlSize(.mini)
                Text("Writing a script…")
            }
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
        } else if HomeRanking.isDated(item), let date = item.scheduledFor.flatMap(IdeaDates.parse) {
            Text(date.formatted(.dateTime.month(.abbreviated).day()))
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(.secondary)
        }
        NativeChip(text: item.pipelineStatus.label, tone: item.pipelineStatus.tone)
    }
}
