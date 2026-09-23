import SwiftUI

/// Send later instead of now. The video, copy, cover and accounts are saved
/// with the schedule, and it can be cancelled from Calendar before sending.
struct PosterSchedulePanel: View {
    @ObservedObject var model: PosterScheduleModel
    let count: Int
    let includesTikTok: Bool
    let disabled: Bool
    let onSchedule: () -> Void
    let onCalendar: () -> Void

    var body: some View {
        PosterDisclosure(title: "Schedule for later") {
            VStack(alignment: .leading, spacing: 10) {
                if model.saved {
                    Label("Your posts are scheduled.", systemImage: "checkmark").font(.system(size: 13, weight: .semibold))
                    Button("View or change them in Calendar", action: onCalendar)
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                } else if model.loadFailed {
                    NativeErrorState(message: "Scheduling couldn't be loaded.") { Task { await model.load() } }
                } else if model.enabled == nil {
                    NativeLoadingState(label: "Checking scheduling")
                } else if model.enabled == false {
                    Text("Scheduled publishing isn't available on this server yet. Calendar dates can still help you plan.")
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                } else {
                    form
                }
            }
            .task { if model.enabled == nil { await model.load() } }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 10) {
            DatePicker("Send at", selection: $model.when, in: Date().addingTimeInterval(60)...)
                .font(.system(size: 13))
                .disabled(model.saving)
                .clickableCursor(enabled: !model.saving)
            Text("Your time zone: \(model.timezone). Sending starts on the first check after this time; platform processing can take longer.")
                .font(.system(size: 12)).foregroundStyle(.secondary)
            if includesTikTok {
                Text("TikTok will receive a draft. Finish and publish it in TikTok.").font(.system(size: 12)).foregroundStyle(.secondary)
            }
            if let error = model.error {
                Text(error).font(.system(size: 12)).foregroundStyle(Color.studioDanger)
            }
            Button(action: onSchedule) {
                HStack(spacing: 6) {
                    if model.saving { ProgressView().controlSize(.mini) }
                    Text(model.saving ? "Saving schedule" : "Schedule \(count) \(count == 1 ? "post" : "posts")")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(EditorSecondaryButtonStyle())
            .disabled(disabled || model.saving || count == 0 || count > 20)
            if count > 20 {
                Text("Schedule up to 20 destinations at a time.").font(.system(size: 12)).foregroundStyle(Color.studioDanger)
            }
        }
    }
}
