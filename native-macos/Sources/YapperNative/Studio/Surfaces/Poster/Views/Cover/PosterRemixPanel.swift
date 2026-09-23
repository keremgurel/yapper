import SwiftUI

/// The AI step, laid out like a message composer: what goes in sits on top as
/// image tiles (the selected frame, the reference thumbnail), the prompt
/// below, and the action in the footer. A reference can be dropped anywhere
/// on the composer.
struct PosterRemixPanel: View {
    @ObservedObject var remix: PosterRemixModel
    let frame: CGImage?
    let onGenerate: () -> Void
    @State private var dropping = false

    private var usingFrame: Bool { remix.useFrame && frame != nil }
    private var prompt: Binding<String> {
        Binding(get: { remix.prompt(usingFrame: usingFrame) }, set: { remix.customPrompt = $0 })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 0) {
                attachments.padding(12)
                NativeTextArea(text: prompt, placeholder: "Describe the thumbnail", font: .system(size: 13), minHeight: 44, chrome: false)
                    .disabled(remix.generating)
                    .padding(.horizontal, 12)
                footer.padding(12)
            }
            .background {
                RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.studioInputBackground)
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(dropping ? Color.yapperOrange : Color.studioLine, lineWidth: dropping ? 1.5 : 1))
            }
            .posterReferenceDrop(isTargeted: $dropping, enabled: !remix.generating, remix: remix)

            if let error = remix.referenceError ?? remix.error {
                Text(error).font(.system(size: 12)).foregroundStyle(NativeChip.Tone.yellow.color)
            }
        }
    }

    private var attachments: some View {
        HStack(alignment: .bottom, spacing: 10) {
            if let frame {
                PosterRemixAttachment(
                    image: frame,
                    label: remix.useFrame ? "Frame" : "Frame off",
                    included: remix.useFrame,
                    toggleHelp: remix.useFrame ? "Leave the frame out" : "Use the selected frame",
                    onToggle: { remix.useFrame.toggle() }
                )
                .disabled(remix.generating)
            }
            if let reference = remix.reference {
                PosterRemixAttachment(
                    image: reference,
                    label: "Reference",
                    included: true,
                    toggleHelp: "Remove reference thumbnail",
                    onToggle: remix.clearReference
                )
                .disabled(remix.generating)
            } else {
                PosterReferenceSlot(onChoose: remix.chooseReference, onPaste: remix.pasteReference)
                    .disabled(remix.generating)
            }
        }
    }

    private var footer: some View {
        HStack(spacing: 8) {
            if remix.customPrompt != nil {
                Button("Reset prompt", systemImage: "arrow.counterclockwise") { remix.customPrompt = nil }
                    .buttonStyle(EditorGhostButtonStyle(size: .mini))
                    .disabled(remix.generating)
            }
            Spacer()
            Text("2 credits").font(.system(size: 11)).foregroundStyle(.secondary)
            Button(action: onGenerate) {
                HStack(spacing: 6) {
                    if remix.generating { ProgressView().controlSize(.mini) } else { Image(systemName: "sparkles") }
                    Text(remix.generating ? "Generating" : "Generate")
                }
            }
            .buttonStyle(EditorPrimaryButtonStyle(size: .small))
            .disabled(remix.generating || prompt.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }
}
