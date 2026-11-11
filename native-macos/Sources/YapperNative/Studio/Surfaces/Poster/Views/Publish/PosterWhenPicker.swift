import SwiftUI

/// Post now or later. Choosing later turns the publish button into the
/// schedule button; the video, copy, cover and accounts are saved with the
/// schedule, and it can be changed or cancelled from Calendar before sending.
struct PosterWhenPicker: View {
    @ObservedObject var model: PosterScheduleModel
    /// TikTok in inbox mode gets a draft at the time, not a post.
    let tiktokInbox: Bool
    let onCalendar: () -> Void

    var body: some View {
        Group {
            if model.saved {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Scheduled for \(PosterQuickTimes.label(model.when))", systemImage: "checkmark")
                        .font(.system(size: 13, weight: .semibold))
                    Button("Change the time or cancel it in Calendar", action: onCalendar)
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                }
            } else if model.enabled == true {
                form
            } else if model.loadFailed {
                HStack(spacing: 8) {
                    Text("Scheduling is unavailable.").font(.system(size: 12)).foregroundStyle(.secondary)
                    Button("Try again") { Task { await model.load() } }.buttonStyle(EditorGhostButtonStyle(size: .small))
                }
            }
        }
        .task { if model.enabled == nil { await model.load() } }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(model.later ? "Publish now instead" : "Schedule instead") { model.later.toggle() }
                .buttonStyle(EditorSecondaryButtonStyle())
                .disabled(model.saving)
            if model.later {
                DatePicker("Send at", selection: $model.when, in: Date().addingTimeInterval(60)...)
                    .font(.system(size: 13))
                    .disabled(model.saving)
                    .clickableCursor(enabled: !model.saving)
                HStack(spacing: 6) {
                    ForEach(PosterQuickTimes.options(from: Date()), id: \.label) { option in
                        Button(option.label) { model.when = option.date }
                            .buttonStyle(EditorGhostButtonStyle(size: .small))
                            .disabled(model.saving)
                    }
                }
                Text("Your time zone: \(model.timezone).").font(.system(size: 12)).foregroundStyle(.secondary)
                if tiktokInbox {
                    Text("TikTok gets a draft at that time, to finish in the app.").font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
            if let error = model.error {
                Text(error).font(.system(size: 12)).foregroundStyle(Color.studioDanger)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
