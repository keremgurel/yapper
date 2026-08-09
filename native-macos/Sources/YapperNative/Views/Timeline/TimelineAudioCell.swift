import SwiftUI

/// The look of a sound on the timeline: its own waveform, its name, and the
/// border that says whether it is selected.
///
/// The waveform is the point. A sound effect is placed against a moment in the
/// speech, and a flat coloured pill gives you nothing to place it by: the
/// transient has to be visible to be lined up with a cut. It is drawn from the
/// file itself and windowed to the part of it the layer actually uses, so
/// trimming the head off a riser takes that part of the drawing away too.
struct TimelineAudioCell: View {
    let name: String
    let peaks: [Float]
    /// The stretch of the file this layer plays, in seconds from its start.
    let sourceStart: Double
    let sourceEnd: Double
    let fileDuration: Double
    let height: Double
    let selected: Bool
    /// What this is playing at, so the drawing agrees with the mix.
    var volume: Double = 1

    var body: some View {
        ZStack(alignment: .leading) {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(Color(red: 0.07, green: 0.25, blue: 0.27).opacity(0.96))

            waveform
        }
        // The name is an overlay, not a child of the stack, and that is the
        // whole reason this cell sits where it should.
        //
        // As a child it decided how wide the cell wanted to be: an icon, a word
        // and its padding is about 26 points, and a quarter-second pop on a
        // zoomed-out timeline is three. The cell was then handed a frame far
        // narrower than it had asked for, and SwiftUI centres a child that will
        // not shrink — so the box, and the trim handles on its edges, were
        // drawn a dozen points to the left of the moment they belong to. Sounds
        // that sat exactly on their cutaways looked early. An overlay never
        // affects the size of what it is over, so the cell is now exactly as
        // wide as the sound is long, and the label simply runs past the end of
        // a short one.
        .overlay(alignment: .topLeading) {
            HStack(spacing: 5) {
                Image(systemName: "waveform")
                Text(name).lineLimit(1)
            }
            .font(.studioCaptionStrong)
            // The fill is dark in both schemes, so the label cannot follow the
            // scheme's primary colour.
            .foregroundStyle(Color.white.opacity(0.95))
            .shadow(color: .black.opacity(0.65), radius: 2, y: 1)
            .fixedSize()
            .padding(.horizontal, selected ? 11 : 7)
            .padding(.top, 3)
            .allowsHitTesting(false)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .stroke(
                    selected ? Color.cyan.opacity(0.9) : Color.secondary.opacity(0.34),
                    lineWidth: selected ? 1.1 : 0.7
                )
        }
        .frame(height: height)
        .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
    }

    @ViewBuilder
    private var waveform: some View {
        // Until the file has been measured, the row keeps its height rather
        // than jumping when the bars arrive.
        if peaks.isEmpty {
            Color.clear
        } else {
            GeometryReader { proxy in
                let window = TimelineWaveformGeometry.window(
                    peakCount: peaks.count,
                    progress: 1,
                    sourceStart: sourceStart,
                    sourceEnd: sourceEnd,
                    mediaDuration: fileDuration
                )
                WaveformShape(
                    peaks: peaks,
                    sampleRange: window.range,
                    color: Color.cyan.opacity(0.72),
                    gain: AudioLevel.waveformGain(volume)
                )
                .frame(width: max(0, proxy.size.width * window.fraction), alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 4)
            .padding(.vertical, 3)
        }
    }
}
