import SwiftUI

/// Simple mode's stand-in for the timeline: the whole edit as one strip to
/// see and seek along. Yappers cut by deleting words, so the tracks stay out
/// of the way until something needs a frame-exact fix, and then the full
/// timeline is one click away, here, without switching to Pro.
struct SimpleScrubber: View {
    @ObservedObject var session: EditorSession
    let showTimeline: () -> Void

    static let height: CGFloat = 56

    var body: some View {
        HStack(spacing: 12) {
            ScrubberTime(clock: session.playbackClock)
                .frame(width: 44, alignment: .leading)
            strip
            Text(formatTime(session.duration))
                .font(.studioTimecode)
                .foregroundStyle(Color.studioTextMuted)
            Button("Show timeline", action: showTimeline)
            .buttonStyle(EditorGhostButtonStyle(size: .small))
            .help("Open the full timeline, for trimming a cut to the frame")
        }
        .padding(.horizontal, 14)
        .frame(height: Self.height)
        .background(Color.panelBackground)
    }

    private var strip: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(Color.studioFaintFill)
                ScrubberMarks(
                    duration: session.duration,
                    clips: session.project.clips.map(\.duration),
                    captions: session.captionsVisible ? session.captionCues.map { $0.timelineStart ... $0.timelineEnd } : [],
                    texts: (session.project.textLayers ?? []).map { $0.timelineStart ... $0.timelineStart + $0.duration },
                    layouts: session.project.resolvedLayoutSpans.flatMap { session.project.timelineRanges(of: $0) }
                )
                ScrubberPlayhead(clock: session.playbackClock, duration: session.duration)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { seek(to: $0.location.x, width: proxy.size.width) }
            )
        }
        .frame(height: 40)
        .accessibilityElement()
        .accessibilityLabel("Playhead")
        .accessibilityValue(formatTime(session.playbackClock.currentTime))
        .accessibilityAdjustableAction { direction in
            let step = direction == .increment ? 1.0 : -1.0
            session.seekToTimelineTime(session.playbackClock.currentTime + step)
        }
    }

    private func seek(to x: CGFloat, width: CGFloat) {
        guard width > 0, session.duration > 0 else { return }
        session.seekToTimelineTime(min(max(0, x / width), 1) * session.duration)
    }
}
