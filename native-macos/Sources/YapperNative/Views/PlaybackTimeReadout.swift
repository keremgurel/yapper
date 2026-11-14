import SwiftUI

/// The `0:00.00 / 0:00.00` readout in the transport.
///
/// It is its own view so that the clock ticking redraws this label alone,
/// instead of the transport bar and the frame-ratio menu beside it.
struct PlaybackTimeReadout: View {
    @ObservedObject var clock: PlaybackClock
    let duration: Double

    var body: some View {
        Text("\(formatTimePrecise(clock.currentTime)) / \(formatTimePrecise(duration))")
            .font(.studioTimecode)
            .foregroundStyle(Color.studioTextMuted)
            // Never wrapped onto a second line or cut: a time that reads
            // "0:00." is not a time.
            .lineLimit(1)
            .fixedSize()
    }
}
