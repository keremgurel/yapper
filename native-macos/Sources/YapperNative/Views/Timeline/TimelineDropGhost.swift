import SwiftUI

/// Watches the drag on its own so a carried item can repaint its landing spot
/// every frame without the rest of the timeline redrawing with it.
struct TimelineDropOverlay: View {
    @ObservedObject var drag: TimelineDragState
    let rows: TimelineRowLayout
    let contentWidth: Double
    let projectDuration: Double

    var body: some View {
        if drag.isDragging, let lift = drag.lift {
            ZStack(alignment: .topLeading) {
                TimelineDropLaneHighlight(lift: lift, rows: rows)
                TimelineDropInsertionLine(lift: lift, rows: rows)
                TimelineDropGhost(
                    lift: lift,
                    rows: rows,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .allowsHitTesting(false)
        }
    }
}

/// The line that says where the drop goes.
///
/// It runs the whole width of the timeline at the edge the item will land
/// against, which is the one piece of feedback that reads at a glance no matter
/// how narrow the clip is or how far along the track it sits. A drop that would
/// add a track draws the line where that track is about to appear, so it never
/// looks like the item is being dropped into the row that happens to be there.
struct TimelineDropInsertionLine: View {
    let lift: TimelineLift
    let rows: TimelineRowLayout

    private var tint: Color {
        lift.target.isBlocked ? Color.studioDanger : Color.yapperOrange
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(tint)
                .frame(height: 2)
                .shadow(color: tint.opacity(0.6), radius: 4)
                .overlay(alignment: .leading) {
                    Text(label)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .frame(height: 15)
                        .background(tint)
                        .clipShape(Capsule(style: .continuous))
                        .offset(y: -9)
                        .fixedSize()
                }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .offset(y: y)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .animation(.spring(response: 0.22, dampingFraction: 0.85), value: y)
    }

    /// Says both things a drop has to answer: which track, and when. The time is
    /// what was missing while dragging along a lane, where every position looks
    /// the same.
    private var label: String {
        guard case let .overlay(lane, isNew) = lift.target.track else {
            return "Video track"
        }
        if lift.target.isBlocked { return "Lane \(lane + 1) is busy here" }
        let track = isNew ? "New track" : "Lane \(lane + 1)"
        return "\(track) · \(TimelineDropInsertionLine.clock(lift.target.start))"
    }

    /// Minutes and seconds to a tenth: precise enough to place a cutaway, short
    /// enough to read while the pointer is moving.
    static func clock(_ seconds: Double) -> String {
        let clamped = max(0, seconds)
        let minutes = Int(clamped) / 60
        let remainder = clamped - Double(minutes * 60)
        return String(format: "%d:%04.1f", minutes, remainder)
    }

    /// The edge the item lands against: the top of the lane it is aiming at, or
    /// the top of the stack when a whole new lane is about to be made there.
    private var y: Double {
        guard let lane = lift.target.overlayLane else {
            return rows.clipRowY - TimelineRowLayout.cellInset
        }
        guard lane < rows.overlayTrackCount else { return rows.overlayStackTop }
        return rows.overlayRowY(track: lane) - TimelineRowLayout.cellInset
    }
}

/// The landing spot for an item being carried onto a lane that already exists:
/// exactly the size it will be, exactly where it will go.
///
/// A drop that would make a new lane draws no box, because there is no row for
/// it to sit in yet — the line above says where the lane will appear, and the
/// item itself is already under the pointer.
struct TimelineDropGhost: View {
    let lift: TimelineLift
    let rows: TimelineRowLayout
    let contentWidth: Double
    let projectDuration: Double

    private var tint: Color {
        lift.target.isBlocked ? Color.studioDanger : Color.yapperOrange
    }

    var body: some View {
        if let lane = lift.target.overlayLane, lane < rows.overlayTrackCount {
            ghost
                // Exactly the size the cell will be, so the ghost is a promise
                // rather than an approximation.
                .frame(width: width, height: TimelineContent.overlayRowHeight)
                .offset(x: x, y: rows.overlayRowY(track: lane))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .allowsHitTesting(false)
                .animation(.spring(response: 0.24, dampingFraction: 0.82), value: lane)
                .animation(.easeOut(duration: 0.1), value: lift.target.isBlocked)
        }
    }

    private var ghost: some View {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(tint.opacity(0.16))
            .overlay {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .strokeBorder(tint, style: StrokeStyle(lineWidth: 1.5, dash: [5, 3]))
            }
    }

    private var width: Double {
        max(6, contentWidth * lift.duration / max(0.001, projectDuration))
    }

    private var x: Double {
        contentWidth * lift.target.start / max(0.001, projectDuration)
    }
}

/// A wash over the lane a drag is aiming at, so the target reads even where the
/// ghost itself is narrow.
struct TimelineDropLaneHighlight: View {
    let lift: TimelineLift
    let rows: TimelineRowLayout

    var body: some View {
        if let lane = lift.target.overlayLane, lane < rows.overlayTrackCount, !lift.target.isBlocked {
            Rectangle()
                .fill(Color.yapperOrange.opacity(0.07))
                .frame(height: TimelineRowLayout.overlayRowHeight)
                .offset(y: rows.overlayRowY(track: lane) - TimelineRowLayout.cellInset)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .allowsHitTesting(false)
                .animation(.easeOut(duration: 0.12), value: lane)
        }
    }
}
