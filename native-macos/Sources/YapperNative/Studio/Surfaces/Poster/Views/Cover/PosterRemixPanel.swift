import SwiftUI

/// The AI step, after the frame is chosen. It starts from the selected
/// frame unless unticked; a reference thumbnail is an optional second input.
struct PosterRemixPanel: View {
    @ObservedObject var remix: PosterRemixModel
    let hasFrame: Bool
    let onGenerate: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            NativeField(label: "What should change") {
                NativeTextArea(text: $remix.prompt, font: .system(size: 13), minHeight: 88)
                    .disabled(remix.generating)
            }
            HStack(spacing: 10) {
                Toggle("Use selected frame", isOn: Binding(get: { remix.useFrame && hasFrame }, set: { remix.useFrame = $0 }))
                    .toggleStyle(.checkbox)
                    .font(.system(size: 13))
                    .disabled(!hasFrame || remix.generating)
                    .clickableCursor(enabled: hasFrame)
                Spacer()
                reference
            }
            Text("2 credits per generation.").font(.system(size: 11)).foregroundStyle(.secondary)
            HStack(spacing: 8) {
                Button(action: onGenerate) {
                    HStack(spacing: 6) {
                        if remix.generating { ProgressView().controlSize(.mini) } else { Image(systemName: "photo.badge.plus") }
                        Text(remix.generating ? "Generating" : "Generate thumbnail")
                    }
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .disabled(remix.generating || remix.prompt.trimmingCharacters(in: .whitespaces).isEmpty)
                Button("Reset prompt", systemImage: "arrow.counterclockwise") { remix.prompt = PosterThumbnailPrompt.standard }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                    .disabled(remix.generating || remix.prompt == PosterThumbnailPrompt.standard)
            }
            if let error = remix.referenceError ?? remix.error {
                Text(error).font(.system(size: 12)).foregroundStyle(NativeChip.Tone.yellow.color)
            }
        }
    }

    @ViewBuilder
    private var reference: some View {
        if let image = remix.reference {
            HStack(spacing: 8) {
                Image(decorative: image, scale: 1).resizable().scaledToFill()
                    .frame(width: 28, height: 28).clipShape(RoundedRectangle(cornerRadius: 4))
                Text(remix.referenceName).font(.system(size: 12)).lineLimit(1)
                Button { remix.clearReference() } label: { Image(systemName: "xmark") }
                    .buttonStyle(EditorGhostButtonStyle(size: .mini))
                    .help("Remove reference thumbnail")
            }
        } else {
            Button("Reference thumbnail", systemImage: "square.and.arrow.up") { remix.chooseReference() }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
                .disabled(remix.generating)
            Button("Paste", systemImage: "doc.on.clipboard") { remix.pasteReference() }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
                .disabled(remix.generating)
        }
    }
}
