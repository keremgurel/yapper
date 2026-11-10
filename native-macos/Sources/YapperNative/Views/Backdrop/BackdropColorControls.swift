import SwiftUI

/// The colours of a preset, one labelled swatch per slot, with a way back to
/// the preset's own. Shared by the overlay's backdrop and the background swap.
struct BackdropColorControls: View {
    let preset: BackdropPreset
    /// What is set now, or `nil` for the preset's own.
    let colors: [String]?
    /// The full list, background first. Empty means "use the preset's own".
    let onChange: ([String]) -> Void

    private var resolved: [String] { preset.resolvedColors(colors) }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(preset.colorNames.enumerated()), id: \.offset) { index, name in
                HStack(spacing: 8) {
                    Text(name)
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .frame(width: 74, alignment: .leading)
                    InspectorColorWell(
                        color: StudioColor(hex: resolved[index]) ?? .black,
                        supportsOpacity: false
                    ) { color, _ in
                        var next = resolved
                        next[index] = String(color.hex.prefix(7))
                        onChange(next)
                    }
                    .environment(\.inspectorControlLabel, name)
                }
            }
            if colors != nil {
                Button("Use the preset's colours") { onChange([]) }
                    .buttonStyle(EditorGhostButtonStyle(size: .mini))
                    .padding(.leading, -6)
            }
        }
    }
}
