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
struct VolumeSlider: View {
    let volume: Double
    let onChange: (Double) -> Void
    let onCommit: () -> Void

    /// Where the handle is while it is being dragged.
    ///
    /// The handle has to move under the pointer whatever the view around it is
    /// watching. Without this it was drawn from `volume`, which comes from a
    /// store the inspector does not observe, so the slider stood still for the
    /// whole drag and jumped to its new value on release: the fader felt stuck
    /// and the change looked like it only landed at the end. The timeline's
    /// waveform follows the store, which it does observe; the handle follows
    /// this.
    @State private var dragging: Double?
    /// What is in the field. Kept apart from the level so a half-typed number
    /// is not read as one: "1" on the way to "125" would otherwise drop the
    /// track to one percent for a keystroke.
    @State private var typed: String?
    @FocusState private var fieldFocused: Bool

    private var shown: Double { dragging ?? volume }

    var body: some View {
        HStack(spacing: 9) {
            Button {
                set(shown > 0 ? AudioLevel.minimum : AudioLevel.unity)
                commit()
            } label: {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .frame(width: 20, height: 20)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .help(shown > 0 ? "Silence this" : "Back to 100%")

            Slider(
                value: Binding(get: { shown }, set: { newValue in set(newValue) }),
                in: AudioLevel.minimum ... AudioLevel.maximum,
                onEditingChanged: { editing in
                    // The one that matters: everything before this was a draft
                    // that never touched the project.
                    if !editing { commit() }
                }
            )
            .controlSize(.small)

            field
        }
    }

    private var field: some View {
        HStack(spacing: 2) {
            TextField(
                "",
                text: Binding(
                    get: { typed ?? String(AudioLevel.percent(shown)) },
                    set: { newValue in typed = newValue }
                )
            )
            .textFieldStyle(.plain)
            .multilineTextAlignment(.trailing)
            .font(.system(size: 11, weight: .semibold))
            .monospacedDigit()
            .focused($fieldFocused)
            .frame(width: 32)
            .onSubmit { commitTyped() }
            .onChange(of: fieldFocused) { _, focused in
                // Clicking away is as much an answer as pressing Return.
                if !focused { commitTyped() }
            }

            Text("%")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 6)
        .frame(height: 22)
        .background(Color.studioFaintFill)
        .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .stroke(
                    fieldFocused ? Color.yapperOrange.opacity(0.7) : Color.studioLine,
                    lineWidth: 1
                )
        }
        .help("Type a level, in percent. 100 is how it was recorded.")
    }

    private func set(_ value: Double) {
        dragging = value
        // A number being dragged is the number the field should show.
        typed = nil
        onChange(value)
    }

    private func commit() {
        onCommit()
        // Back to reading the saved value, now that there is one to read.
        dragging = nil
    }

    /// Reads what was typed, if it was a number. Anything else puts the field
    /// back to the level it is really at rather than arguing about it.
    private func commitTyped() {
        guard let entry = typed else { return }
        typed = nil
        guard let percent = AudioLevel.percentTyped(entry) else { return }
        set(percent)
        commit()
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
