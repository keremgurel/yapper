import SwiftUI

/// A fader, with the number it is at, typed or dragged.
///
/// A slider rather than the four preset buttons this replaced, because volume
/// is a thing people set by ear: you pull it until it sits under the voice, and
/// the level that does that is rarely 50, 75, 100 or 125.
///
/// And a field beside it, because the other half of the time you know the
/// number. Typing 100 is how you get back to unity, which is why there is no
/// button for it: a control that only does what the field already does is one
/// more thing to read.
///
/// The level shown is, in order: where the handle is being dragged, what was
/// just committed and is still on its way into the project, and what the
/// project has saved. The middle one is what stops the jump. The project is
/// written by an action that lands a beat after the drag or the Return key,
/// and reading the saved value in that beat drew the old level for a frame
/// before the new one arrived: the handle snapped back and forward, and a
/// typed 40 showed 21 and then 40.
struct VolumeSlider: View {
    let volume: Double
    let onChange: (Double) -> Void
    let onCommit: () -> Void
    var maximum: Double = AudioLevel.maximum
    var accessibilityName = "Volume"

    /// Where the handle is while it is being dragged.
    @State private var dragging: Double?
    /// What was committed last, held until the project reports it back.
    @State private var held: Double?

    private var shown: Double { dragging ?? held ?? volume }

    var body: some View {
        HStack(spacing: 10) {
            Button {
                set(shown > 0 ? AudioLevel.minimum : AudioLevel.unity)
                commit()
            } label: {
                Image(systemName: icon)
                    .font(.studioCaptionStrong)
                    .foregroundStyle(.secondary)
                    .frame(width: 20, height: 20)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .accessibilityLabel(shown > 0 ? "Silence \(accessibilityName)" : "Reset \(accessibilityName) to 100%")
            .help(shown > 0 ? "Silence this" : "Back to 100%")

            VolumeFader(
                value: shown,
                maximum: maximum,
                accessibilityName: accessibilityName,
                onDrag: set,
                onRelease: commit
            )

            VolumePercentField(
                percent: AudioLevel.percent(shown),
                accessibilityName: accessibilityName
            ) { level in
                set(level)
                commit()
            }
        }
        .onChange(of: volume) {
            // The project caught up. Anything else arriving here (an undo, a
            // fader moved elsewhere) is the new truth, so it replaces what was
            // held either way.
            held = nil
        }
    }

    private func set(_ value: Double) {
        let value = AudioLevel.snapped(min(maximum, AudioLevel.clamped(value)))
        guard value != dragging else { return }
        dragging = value
        onChange(value)
    }

    /// Once per gesture: on release, on Return, on a click of the speaker.
    private func commit() {
        guard let value = dragging else { return }
        held = abs(value - volume) > 0.0005 ? value : nil
        dragging = nil
        onCommit()
    }

    private var icon: String {
        switch AudioLevel.percent(shown) {
        case 0: "speaker.slash.fill"
        case ..<60: "speaker.fill"
        case ..<110: "speaker.wave.1.fill"
        default: "speaker.wave.3.fill"
        }
    }
}
