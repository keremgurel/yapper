import SwiftUI

/// Recent activity: the videos the rule picked up, newest first.
struct AutomationHistorySection: View {
    let runs: [AutomationRun]
    @ObservedObject var store: AutomationStore

    var body: some View {
        NativeSection(title: "Recent activity", card: true) {
            Button { Task { await store.refresh() } } label: {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
            .buttonStyle(EditorGhostButtonStyle(size: .small))
        } content: {
            if runs.isEmpty {
                AutomationNote(text: "New Instagram videos will appear here after the rule is enabled and checked.", size: 13)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(runs.enumerated()), id: \.element.id) { index, run in
                        if index > 0 { Rectangle().fill(Color.studioLine).frame(height: 1) }
                        AutomationRunRow(run: run, canRetry: store.canRetry, store: store)
                    }
                }
                Button("Manage deliveries and retries in Calendar") {
                    StudioNavigation.shared.goTo(.calendar)
                }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
            }
        }
    }
}
