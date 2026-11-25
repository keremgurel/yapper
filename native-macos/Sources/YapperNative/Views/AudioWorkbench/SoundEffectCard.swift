import SwiftUI

/// One shipped sound: what it is, how long it runs, and its waveform to click
/// or drag through before adding it at the playhead.
struct SoundEffectCard: View {
    @ObservedObject var session: EditorSession
    @ObservedObject private var waveforms = SoundWaveforms.shared
    let effect: SoundEffectDescriptor

    private var isPlaying: Bool { session.previewingSoundID == effect.id }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(effect.name).font(.studioBodyStrong).lineLimit(1)
                Spacer(minLength: 4)
                Text(SoundLength.label(effect.duration))
                    .font(.studioCaption)
                    .monospacedDigit()
                    .foregroundStyle(Color.studioTextMuted)
            }
            Text(effect.detail)
                .font(.studioCaption)
                .foregroundStyle(Color.studioTextMuted)
                .lineLimit(1)
            HStack(spacing: 8) {
                Button {
                    if isPlaying { session.stopSoundPreview() } else { Task { await session.previewSoundEffect(effect) } }
                } label: {
                    Image(systemName: isPlaying ? "stop.fill" : "play.fill")
                        .font(.system(size: 10, weight: .bold))
                        .frame(width: 26, height: 26)
                        .background(Color.studioFaintFill, in: Circle())
                        .contentShape(Circle())
                }
                .buttonStyle(.studioPlain)
                .foregroundStyle(isPlaying ? Color.studioAccent : Color.primary)
                .accessibilityLabel(isPlaying ? "Stop \(effect.name)" : "Preview \(effect.name)")

                SoundScrubStrip(
                    peaks: waveforms.peaks[effect.id] ?? Array(repeating: 0.25, count: SoundWaveforms.bars),
                    isPlaying: isPlaying,
                    progress: { session.soundPreviewProgress },
                    onScrub: { fraction in Task { await session.previewSoundEffect(effect, from: fraction) } }
                )
                .frame(height: 26)

                Button {
                    Task { await session.addSoundEffect(effect) }
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 11, weight: .bold))
                        .frame(width: 26, height: 26)
                        .foregroundStyle(session.project.clips.isEmpty ? Color.secondary : Color.studioAccentForeground)
                        .background(session.project.clips.isEmpty ? Color.studioFaintFill : Color.studioAccent,
                                    in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
                .buttonStyle(.studioPlain)
                .disabled(session.project.clips.isEmpty)
                .help("Add \(effect.name) at the playhead")
                .accessibilityLabel("Add \(effect.name) at the playhead")
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.raisedBackground)
        .overlay {
            RoundedRectangle(cornerRadius: AudioWorkbenchMetrics.cardRadius, style: .continuous)
                .stroke(isPlaying ? Color.studioAccent.opacity(0.5) : Color.studioLine, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: AudioWorkbenchMetrics.cardRadius, style: .continuous))
        .onAppear { waveforms.load(effect) }
    }
}

/// A sound's waveform. Click or drag anywhere to hear it from there; while it
/// plays, the part already heard is filled in.
private struct SoundScrubStrip: View {
    let peaks: [Float]
    let isPlaying: Bool
    let progress: () -> Double
    let onScrub: (Double) -> Void
    @State private var lastScrub = Date.distantPast

    var body: some View {
        GeometryReader { proxy in
            TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !isPlaying)) { _ in
                let played = isPlaying ? progress() : 0
                HStack(alignment: .center, spacing: 1.5) {
                    ForEach(Array(peaks.enumerated()), id: \.offset) { index, peak in
                        let heard = Double(index) / Double(max(1, peaks.count)) < played
                        Capsule()
                            .fill(heard ? Color.studioAccent : Color.studioTextMuted.opacity(0.55))
                            .frame(height: max(2, CGFloat(peak) * proxy.size.height))
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        // A drag restarts the sound at most every 80 ms, which
                        // reads as scrubbing without stuttering.
                        guard Date().timeIntervalSince(lastScrub) > 0.08 else { return }
                        lastScrub = Date()
                        onScrub(min(1, max(0, value.location.x / max(1, proxy.size.width))))
                    }
            )
        }
        .accessibilityLabel("Waveform. Click to hear from that point.")
    }
}

/// A sound's length, the way a creator reads it.
enum SoundLength {
    static func label(_ seconds: Double) -> String {
        if seconds < 10 { return String(format: "%.1fs", seconds) }
        let total = Int(seconds.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}
