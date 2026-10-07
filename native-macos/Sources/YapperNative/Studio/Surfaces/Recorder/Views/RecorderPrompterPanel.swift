import SwiftUI

/// The teleprompter's pace and look: speed, text size, height, shade and
/// the pause before it starts moving.
struct RecorderPrompterPanel: View {
    @ObservedObject var store: TeleprompterSettingsStore
    var compact = false

    var body: some View {
        NativeSection(title: "Teleprompter", card: true) {
            VStack(alignment: .leading, spacing: 12) {
                NativeField(label: "Speed: \(store.settings.wordsPerMinute) words/min") {
                    Slider(value: Binding(get: { Double(store.settings.wordsPerMinute) }, set: { store.settings.wordsPerMinute = Int($0) }), in: 60...240, step: 5)
                        .accessibilityLabel("Teleprompter speed")
                        .accessibilityValue("\(store.settings.wordsPerMinute) words per minute")
                }
                NativeField(label: "Text size: \(Int(TeleprompterSettings.baseFontSize * store.settings.fontScale)) pt") {
                    Slider(value: $store.settings.fontScale, in: 0.7...2, step: 0.05)
                        .accessibilityLabel("Teleprompter text size")
                }
                if !compact {
                row("Height", TeleprompterSettings.heights, $store.settings.heightFraction)
                row("Shade", TeleprompterSettings.shades, $store.settings.shade)
                row("Lead-in", TeleprompterSettings.leadIns, $store.settings.leadInSeconds)
                }
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
