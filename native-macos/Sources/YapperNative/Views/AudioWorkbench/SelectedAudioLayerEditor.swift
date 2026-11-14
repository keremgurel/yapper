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
            // On one line when there is room. In a narrow pane the two
            // actions move under the name rather than squeezing it.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 10) {
                    identity.fixedSize()
                    Spacer(minLength: 8)
                    actions
                }
                VStack(alignment: .leading, spacing: 8) {
                    identity
                    actions
                }
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

    /// What the sound is and where it sits.
    private var identity: some View {
        HStack(spacing: 10) {
            AudioIconTile(systemName: layer.builtInID == nil ? "waveform" : "sparkles")
            VStack(alignment: .leading, spacing: 2) {
                Text(layer.name)
                    .font(.studioBodyStrong)
                    .lineLimit(2)
                    .truncationMode(.middle)
                    .help(layer.name)
                Text("Starts at \(formatTimePrecise(layer.timelineStart)) · \(AudioLength.short(layer.duration)) long")
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
                    .monospacedDigit()
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var actions: some View {
        HStack(spacing: 6) {
            // Changing your mind about which click it is should not mean
            // finding the moment again: see EditorSession+SoundSwap.
            Menu("Replace") {
                SoundSwapMenu(session: session, layer: layer)
            }
            .menuStyle(.borderlessButton)
            .font(.studioLabelStrong)
            .fixedSize()
            .help("Swap this for another sound, keeping its place")

            Button(role: .destructive) {
                Task { await session.deleteSelectedAudioLayer() }
            } label: {
                StudioGlyph(.delete, size: 15).frame(width: 28, height: 28)
            }
            .buttonStyle(EditorGhostButtonStyle(size: .mini))
            .accessibilityLabel("Delete \(layer.name)")
            .help("Delete this sound")
        }
        .fixedSize()
    }
}
