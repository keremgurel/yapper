import SwiftUI

/// Post now or later. Choosing later turns the publish button into the
/// schedule button; the video, copy, cover and accounts are saved with the
/// schedule, and it can be changed or cancelled from Calendar before sending.
struct PosterWhenPicker: View {
    @ObservedObject var model: PosterScheduleModel
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
                NativeErrorState(message: "Scheduling couldn't be loaded.") { Task { await model.load() } }
            }
        }
        .task { if model.enabled == nil { await model.load() } }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("When", selection: $model.later) {
                Text("Post now").tag(false)
                Text("Schedule").tag(true)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .disabled(model.saving)
            .clickableCursor(enabled: !model.saving)
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
            }
            if let error = model.error {
                Text(error).font(.system(size: 12)).foregroundStyle(Color.studioDanger)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
