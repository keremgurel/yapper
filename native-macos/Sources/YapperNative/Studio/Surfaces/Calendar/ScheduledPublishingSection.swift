import SwiftUI

/// Posts queued to send from Poster, above the planning calendar. Hidden
/// when the server has scheduling off and nothing was ever queued.
struct ScheduledPublishingSection: View {
    @ObservedObject var store: SchedulesStore = .shared

    var body: some View {
        if !store.isHidden {
            NativeSection(title: "Scheduled publishing", card: true) {
                Button { Task { await store.refresh() } } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
            } content: {
                content
            }
            .padding(.bottom, 24)
        }
    }

    @ViewBuilder
    private var content: some View {
        let rows = store.rows
        if store.refreshFailed {
            message("Scheduled posts couldn't be refreshed. Try Refresh again.", danger: true)
        }
        if let response = store.response {
            if rows.isEmpty {
                HStack(spacing: 8) {
                    message("No publishing schedules yet. Prepare a video in Poster and choose \"Schedule for later\".")
                    Button("Open Poster") { StudioNavigation.shared.goTo(.poster) }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                }
            } else {
                if !response.enabled {
                    message("Scheduled publishing is paused on this server. Your saved posts remain here, and you can cancel them before sending resumes.")
                }
                VStack(spacing: 0) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                        if index > 0 { Rectangle().fill(Color.studioLine).frame(height: 1) }
                        ScheduleRowView(row: row, store: store)
                    }
                }
            }
        } else if !store.refreshFailed {
            message("Loading scheduled posts…")
        }
    }

    private func message(_ text: String, danger: Bool = false) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(danger ? Color.studioDanger : Color.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}
