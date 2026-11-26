import SwiftUI

/// Simple or Pro, in the editor's top bar.
struct EditorModePicker: View {
    @AppStorage(EditorMode.storageKey) private var modeRaw = EditorMode.simple.rawValue

    var body: some View {
        InspectorSegmentedControl(
            options: EditorMode.allCases.map { .init(value: $0, label: $0.title) },
            selection: EditorMode(rawValue: modeRaw) ?? .simple,
            onSelect: { mode in
                withAnimation(.easeInOut(duration: 0.2)) { modeRaw = mode.rawValue }
            }
        )
        .fixedSize()
        .help((EditorMode(rawValue: modeRaw) ?? .simple).purpose)
    }
}
