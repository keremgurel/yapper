import SwiftUI

/// The teleprompter's pace and look: speed, text size, height, shade and
/// the pause before it starts moving.
struct RecorderPrompterPanel: View {
    @ObservedObject var store: TeleprompterSettingsStore

    var body: some View {
        NativeSection(title: "Teleprompter", card: true) {
            VStack(alignment: .leading, spacing: 12) {
                row("Speed in words per minute", TeleprompterSettings.speeds, $store.settings.wordsPerMinute)
                row("Text size", TeleprompterSettings.fontScales, $store.settings.fontScale)
                row("Height", TeleprompterSettings.heights, $store.settings.heightFraction)
                row("Shade", TeleprompterSettings.shades, $store.settings.shade)
                row("Lead-in", TeleprompterSettings.leadIns, $store.settings.leadInSeconds)
            }
        }
    }

    private func row<Value: Hashable & Sendable>(
        _ label: String, _ options: [TeleprompterSettings.Option<Value>], _ binding: Binding<Value>
    ) -> some View {
        NativeField(label: label) {
            RecorderSegmented(options: options, selection: binding)
        }
    }
}
