import AppKit
import SwiftUI
import UniformTypeIdentifiers

/// The quiet Saved / Saving note beside a form.
struct BrainSaveNote: View {
    let state: BrainSaveState
    var body: some View {
        if let label = state.label {
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(state == .error ? Color.studioDanger : .secondary)
        }
    }
}

/// A chip that toggles, for tag filters and surface pickers.
struct BrainToggleChip: View {
    let text: String
    let on: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            NativeChip(text: text, tone: on ? .cyan : .neutral)
        }
        .buttonStyle(.studioPlain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// A checkbox with its label, for review lists.
struct BrainCheckRow<Label: View>: View {
    @Binding var isOn: Bool
    @ViewBuilder var label: () -> Label
    var body: some View {
        Toggle(isOn: $isOn) { label() }
            .toggleStyle(.checkbox)
            .clickableCursor()
    }
}

/// A danger-toned line that names what went wrong.
struct BrainInlineError: View {
    let message: String
    var body: some View {
        Text(message)
            .font(.system(size: 12))
            .foregroundStyle(Color.studioDanger)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Picks a text file the way the web's file input did.
@MainActor
enum BrainFilePicker {
    static func chooseTextFile() -> URL? {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = BrainIngestStore.importableExtensions.compactMap { UTType(filenameExtension: $0) }
        return panel.runModal() == .OK ? panel.url : nil
    }
}
