import SwiftUI

/// The orange guide that appears while a drag is snapping to something. Like
/// the playhead it observes the state that moves, not the whole session.
struct TimelineSnapGuideLine: View {
    @ObservedObject var drag: TimelineDragState
    let duration: Double
    let contentWidth: Double
    let height: Double

    var body: some View {
        if let snap = drag.snap {
            Rectangle()
                .fill(Color.yapperOrange.opacity(0.92))
                .frame(width: 1, height: height)
                .overlay(alignment: .topLeading) {
                    HStack(spacing: 4) {
                        Image(systemName: snap.kind == .audio ? "waveform" : "arrow.left.and.right")
                        Text("\(snap.kind.title)  \(formatTimelineTrimTime(snap.time))")
                    }
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 6)
                    .frame(height: 20)
                    .background(Color.yapperOrange.opacity(0.96))
                    .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                    .fixedSize()
                    .offset(x: 4, y: -1)
                }
                .offset(
                    x: TimelineMetrics.x(
                        for: snap.time,
                        duration: duration,
                        width: contentWidth
                    ) - 0.5
                )
                .allowsHitTesting(false)
        }
    }
}
