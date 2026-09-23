import AppKit
import SwiftUI

/// One Instagram video the rule picked up: its state, where it went, and a
/// retry when the import failed.
struct AutomationRunRow: View {
    let run: AutomationRun
    let canRetry: Bool
    @ObservedObject var store: AutomationStore

    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(run.title).font(.system(size: 13, weight: .semibold)).lineLimit(2)
                Spacer(minLength: 0)
                Text(run.status.label).font(.system(size: 12)).foregroundStyle(.secondary)
            }
            if let url = run.sourceURL {
                Button("View Instagram post") { NSWorkspace.shared.open(url) }
                    .buttonStyle(EditorGhostButtonStyle(size: .mini))
            }
            ForEach(run.schedules) { schedule in
                AutomationNote(text: "\(schedule.platformLabel) · \(schedule.accountLabel) · \(schedule.status.deliveryLabel)")
            }
            if let code = run.error {
                AutomationNote(text: AutomationErrorCopy.message(forCode: code), danger: true)
            }
            if run.status == .failed {
                Button(busy ? "Requesting retry…" : "Retry import") { Task { await retry() } }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                    .disabled(busy || !canRetry)
            }
            if let error {
                AutomationNote(text: error, danger: true)
            }
        }
        .padding(.vertical, 14)
    }

    private func retry() async {
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await store.retry(run)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
