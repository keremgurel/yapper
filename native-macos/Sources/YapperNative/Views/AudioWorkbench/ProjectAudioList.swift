import SwiftUI

/// Every sound already placed in the project, in the order it plays, as one
/// list. Clicking a row selects it and moves the playhead to it.
struct ProjectAudioList: View {
    @ObservedObject var session: EditorSession
    let layers: [ProjectAudioLayer]

    private var ordered: [ProjectAudioLayer] {
        layers.sorted { $0.timelineStart < $1.timelineStart }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AudioWorkbenchMetrics.headingSpacing) {
            AudioSectionHeading(title: "In this project")

            VStack(spacing: 0) {
                ForEach(Array(ordered.enumerated()), id: \.element.id) { index, layer in
                    if index > 0 { Divider().padding(.leading, 50) }
                    row(layer)
                }
            }
            .background(Color.raisedBackground)
            .overlay {
                RoundedRectangle(cornerRadius: AudioWorkbenchMetrics.cardRadius, style: .continuous)
                    .stroke(Color.studioLine, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: AudioWorkbenchMetrics.cardRadius, style: .continuous))
        }
    }

    private func row(_ layer: ProjectAudioLayer) -> some View {
        let selected = session.selectedAudioLayerID == layer.id
        return Button {
            session.selectAudioLayer(layer.id)
            session.scrub(to: layer.timelineStart)
            session.finishScrubbing(at: layer.timelineStart)
        } label: {
            HStack(spacing: 10) {
                AudioIconTile(systemName: layer.builtInID == nil ? "waveform" : "sparkles")
                Text(layer.name)
                    .font(.studioBodyStrong)
                    .lineLimit(1)
                Spacer(minLength: 8)
                Text("\(AudioLevel.percent(session.volume(for: layer)))%")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
                Text(formatTimePrecise(layer.timelineStart))
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
                    .frame(minWidth: 58, alignment: .trailing)
            }
            .padding(.horizontal, 10)
            .frame(height: 46)
            .background(selected ? Color.studioSelectedFill : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
