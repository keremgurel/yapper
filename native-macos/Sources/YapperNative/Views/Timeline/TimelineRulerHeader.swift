import SwiftUI

/// The timestamps strip, pinned above the tracks.
///
/// It used to be drawn inside the scrolling content, so scrolling the tracks up
/// carried the timestamps off the top of the panel and left nothing to read the
/// playhead against. It follows the timeline sideways and through a zoom, and
/// stays put vertically, which is what every editor does with a ruler.
struct TimelineRulerHeader: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var viewport: TimelineViewportState
    /// Published separately from the session so the moving playhead redraws
    /// this strip and nothing else.
    @ObservedObject var clock: PlaybackClock
    let layout: TimelineViewportLayout
    let contentWidth: Double
    /// Width of the fixed track-label column the strip starts after.
    let railWidth: Double

    private static let coordinateSpaceName = "yapper.timeline.ruler"

    var body: some View {
        HStack(spacing: 0) {
            Color.panelBackground.frame(width: railWidth)
            Rectangle().fill(Color.studioLine).frame(width: 1)
            strip
        }
        .frame(height: TimelineRowLayout.rulerHeight)
        .background(Color.panelBackground)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }

    private var strip: some View {
        TimelineRuler(
            duration: session.duration,
            width: contentWidth,
            visible: TimelineRulerTicks.window(
                scrollX: viewport.scrollX,
                viewportWidth: layout.viewportWidth
            )
        )
            .frame(width: contentWidth, height: TimelineRowLayout.rulerHeight)
            .padding(.leading, layout.leadingInset)
            .padding(.trailing, layout.trailingInset)
            .offset(x: -viewport.scrollX)
            .frame(
                width: layout.viewportWidth,
                height: TimelineRowLayout.rulerHeight,
                alignment: .leading
            )
            .overlay(alignment: .leading) { playheadKnob }
            .clipped()
            .contentShape(Rectangle())
            .cursor(.resizeLeftRight)
            .coordinateSpace(name: Self.coordinateSpaceName)
            .gesture(seekGesture)
    }

    /// The playhead's handle rides the ruler, so there is something to grab and
    /// something to read the time against even when the tracks are scrolled.
    /// Even, and centred with the same arithmetic the line below it uses, so
    /// the two share a centre and both land on whole pixels. An odd width here
    /// put the knob on a half pixel at every scale, which is what made it look
    /// as though it were sitting beside its own line rather than on it.
    private static let knobSize = 10.0

    private var playheadKnob: some View {
        Circle()
            .fill(Color.red)
            .frame(width: Self.knobSize, height: Self.knobSize)
            .offset(x: knobX - Self.knobSize / 2, y: 9)
            .allowsHitTesting(false)
            .opacity(session.duration > 0 ? 1 : 0)
    }

    private var knobX: Double {
        layout.leadingInset - viewport.scrollX + TimelineMetrics.x(
            for: clock.currentTime,
            duration: session.duration,
            width: contentWidth
        )
    }

    /// The strip scrolls under a fixed frame, so a pointer position has to be
    /// carried back into the timeline's own coordinates before it means a time.
    private func time(at x: Double) -> Double {
        TimelineMetrics.time(
            for: x + viewport.scrollX - layout.leadingInset,
            duration: session.duration,
            width: contentWidth
        )
    }

    private var seekGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.coordinateSpaceName))
            .onChanged { value in
                session.scrub(to: time(at: value.location.x))
            }
            .onEnded { value in
                session.finishScrubbing(at: time(at: value.location.x))
            }
    }
}
