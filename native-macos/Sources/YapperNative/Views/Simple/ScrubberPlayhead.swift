import SwiftUI

/// The red line on the scrubber and the time beside it. Each watches the
/// clock alone, so a playing video redraws a line and a label, not the strip.
struct ScrubberPlayhead: View {
    @ObservedObject var clock: PlaybackClock
    let duration: Double

    var body: some View {
        GeometryReader { proxy in
            Rectangle()
                .fill(Color.red)
                .frame(width: 2, height: proxy.size.height)
                .offset(x: duration > 0 ? min(1, clock.currentTime / duration) * proxy.size.width - 1 : 0)
        }
        .allowsHitTesting(false)
    }
}

struct ScrubberTime: View {
    @ObservedObject var clock: PlaybackClock

    var body: some View {
        Text(formatTime(clock.currentTime))
            .font(.studioTimecode)
            .foregroundStyle(Color.studioTextMuted)
    }
}
