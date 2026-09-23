import AppKit
import SwiftUI

/// One queued post: what, where, when, its state, and the changes it allows
/// (move, retry at a new time, cancel).
struct ScheduleRowView: View {
    let row: ScheduleSummary
    @ObservedObject var store: SchedulesStore

    @State private var editing = false
    @State private var when = Date()
    @State private var busy = false
    @State private var error: String?

    private var changeable: Bool { row.status == .scheduled || row.status == .failed }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            summary
            if let code = row.error {
                note(ScheduleErrorCopy.message(forCode: code), danger: true)
            }
            if row.status == .draft {
                note("Open TikTok notifications to finish and publish this draft.")
            }
            actions
            if editing { timeEditor }
            if let error { note(error, danger: true) }
        }
        .padding(.vertical, 14)
    }

    private var summary: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(row.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                Text("\(row.platformLabel) · \(row.accountLabel)")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
                Text(whenLabel).font(.system(size: 12)).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            NativeChip(text: row.status.label, tone: row.status.tone, dot: true)
        }
    }

    private var whenLabel: String {
        guard let date = row.scheduledDate else { return row.timezone }
        let zone = TimeZone(identifier: row.timezone) ?? .current
        let style = Date.FormatStyle(date: .abbreviated, time: .shortened, timeZone: zone)
        return "\(date.formatted(style)) · \(row.timezone)"
    }

    @ViewBuilder
    private var actions: some View {
        let hasLinks = row.contentItemId != nil || row.postURL != nil
        if hasLinks || changeable {
            HStack(spacing: 8) {
                if let id = row.contentItemId {
                    Button("Open idea") { StudioNavigation.shared.openIdea(id) }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                }
                if let url = row.postURL {
                    Button("View post") { NSWorkspace.shared.open(url) }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                }
                if changeable {
                    Button(row.status == .failed ? "Choose a retry time" : "Change time") { toggleEditor() }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                        .disabled(busy)
                    Button("Cancel") { Task { await change(.cancel) } }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                        .disabled(busy)
                }
            }
        }
    }

    private var timeEditor: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                DatePicker("New time", selection: $when, displayedComponents: [.date, .hourAndMinute])
                    .labelsHidden()
                    .datePickerStyle(.field)
                    .fixedSize()
                    .disabled(busy)
                Button { Task { await change(row.status == .failed ? .retry : .reschedule) } } label: {
                    HStack(spacing: 6) {
                        if busy { ProgressView().controlSize(.mini) }
                        Text("Save time")
                    }
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .disabled(busy)
            }
            note("Entered in your current time zone: \(TimeZone.current.identifier).")
        }
    }

    private func note(_ text: String, danger: Bool = false) -> some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundStyle(danger ? Color.studioDanger : Color.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func toggleEditor() {
        let soonest = Date().addingTimeInterval(5 * 60)
        when = max(row.scheduledDate ?? soonest, soonest)
        editing.toggle()
    }

    private func change(_ action: ScheduleAction) async {
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await store.change(row, action: action, to: when)
            editing = false
        } catch {
            self.error = error.localizedDescription
        }
    }
}
