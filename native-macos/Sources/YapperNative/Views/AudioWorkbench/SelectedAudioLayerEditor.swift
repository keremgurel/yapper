import SwiftUI

/// The sound selected on the timeline: what it is, where it starts, how loud
/// it plays, and the two things you can do to it.
///
/// Replace and Delete are both quiet buttons. Neither is the thing you came
/// here for most of the time, which is the fader, so neither is filled.
struct SelectedAudioLayerEditor: View {
    @ObservedObject var session: EditorSession
    let layer: ProjectAudioLayer

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                AudioIconTile(systemName: layer.builtInID == nil ? "waveform" : "sparkles")

                VStack(alignment: .leading, spacing: 2) {
                    Text(layer.name)
                        .font(.studioBodyStrong)
                        .lineLimit(1)
                    Text("Starts at \(formatTimePrecise(layer.timelineStart)) · \(AudioLength.short(layer.duration)) long")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }

                Spacer(minLength: 8)

                // Changing your mind about which click it is should not mean
                // finding the moment again: see EditorSession+SoundSwap.
                Menu {
                    SoundSwapMenu(session: session, layer: layer)
                } label: {
                    Label("Replace", systemImage: "arrow.2.squarepath")
                        .font(.studioCaptionStrong)
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                .help("Swap this for another sound, keeping its place")

                Button(role: .destructive) {
                    Task { await session.deleteSelectedAudioLayer() }
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 12, weight: .semibold))
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(EditorGhostButtonStyle(size: .mini))
                .accessibilityLabel("Delete \(layer.name)")
                .help("Delete this sound")
            }

            HStack(spacing: 10) {
                Text("Volume")
                    .font(.studioCaptionStrong)
                    .foregroundStyle(.secondary)
                    .fixedSize()
                VolumeSlider(
                    volume: session.volume(for: layer),
                    onChange: { session.previewVolume($0, for: layer.id) },
                    onCommit: { session.commitLayerVolume() }
                )
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.raisedBackground)
        .overlay {
            RoundedRectangle(cornerRadius: AudioWorkbenchMetrics.cardRadius, style: .continuous)
                .stroke(Color.studioLineStrong, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: AudioWorkbenchMetrics.cardRadius, style: .continuous))
    }
}
