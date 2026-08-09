import SwiftUI

/// The red line down the tracks, at the moment the player is showing.
///
/// Only the line. The knob you grab lives on the ruler, where the pointer can
/// reach it whatever the tracks are scrolled to (`TimelineRulerHeader`). There
/// used to be a second dot here as well, a little way down the line, and it
/// read as a mistake: two dots thirty points apart, the lower one belonging to
/// nothing, and centred on a line an odd number of points wide so it never
/// quite sat straight.
struct TimelinePlayheadLine: View {
    @ObservedObject var clock: PlaybackClock
    let duration: Double
    let contentWidth: Double
    let height: Double

    /// Even, so the line lands on whole pixels at every scale rather than
    /// being smeared across two of them.
    private static let lineWidth = 2.0

    var body: some View {
        Rectangle()
            .fill(Color.red)
            .frame(width: Self.lineWidth, height: height)
            .offset(
                x: TimelineMetrics.x(
                    for: clock.currentTime,
                    duration: duration,
                    width: contentWidth
                ) - Self.lineWidth / 2
            )
            .allowsHitTesting(false)
    }
}
