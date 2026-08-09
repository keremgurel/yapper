import SwiftUI

/// The diamonds along the bottom of a cell that say where its picture moves.
///
/// A move leaves no trace on the footage: the thumbnails look exactly the same
/// whether the shot is pushing in or standing still, so without these the only
/// way to find out is to scrub and watch.
///
/// They are also how a move is edited. Clicking one parks the playhead on it,
/// which is what selecting a keyframe amounts to — every control that changes a
/// framing already works on the moment you are standing on, so arriving there
/// is the whole of it. Dragging one changes when it happens, which is how the
/// speed of a push-in is set: closer together is a snap, further apart is a
/// slow drift.
struct TimelineKeyMarkers: View {
    /// Where each key sits, in seconds along this cell.
    let times: [Double]
    /// How long the cell is, in seconds.
    let span: Double
    let cellWidth: Double
    /// Which key the playhead is on, so the one being worked on is obvious.
    var activeTime: Double?
    let onSelect: (Double) -> Void
    /// From, to. Both in the cell's own seconds.
    var onMove: ((Double, Double) -> Void)?
    var onRemove: ((Double) -> Void)?

    /// Big enough to hit without aiming. The first version was seven points and
    /// unmissable only if you already knew where it was.
    private static let size: Double = 11
    private static let hitInset: Double = -7

    @State private var dragging: (from: Double, to: Double)?

    var body: some View {
        if !times.isEmpty, span > 0, cellWidth > 0 {
            ZStack(alignment: .leading) {
                ForEach(times, id: \.self) { time in
                    marker(time)
                }
            }
            .frame(width: max(1, cellWidth), height: Self.size + 4, alignment: .leading)
            .padding(.bottom, 1)
        }
    }

    private func marker(_ time: Double) -> some View {
        let shown = dragging?.from == time ? (dragging?.to ?? time) : time
        let isActive = activeTime.map { abs($0 - time) < 0.02 } ?? false
        return Image(systemName: isActive ? "diamond.fill" : "diamond")
            .font(.system(size: Self.size, weight: .bold))
            .foregroundStyle(Color.yapperOrange)
            .shadow(color: .black.opacity(0.75), radius: 1.5)
            .contentShape(Rectangle().inset(by: Self.hitInset))
            .cursor(.resizeLeftRight)
            .onTapGesture { onSelect(time) }
            .gesture(dragGesture(of: time))
            .onTapGesture(count: 2) { onRemove?(time) }
            .help("Keyframe · drag to move it, double-click to remove it")
            .offset(x: x(of: shown) - Self.size / 2)
    }

    private func dragGesture(of time: Double) -> some Gesture {
        DragGesture(minimumDistance: 2)
            .onChanged { value in
                guard onMove != nil else { return }
                let delta = Double(value.translation.width) / cellWidth * span
                dragging = (time, min(span, max(0, time + delta)))
            }
            .onEnded { _ in
                if let dragging, let onMove { onMove(dragging.from, dragging.to) }
                dragging = nil
            }
    }

    private func x(of time: Double) -> Double {
        cellWidth * min(1, max(0, time / span))
    }
}

/// The clip flavour: keys are stored in the media's own seconds, so a trimmed
/// clip shows only the ones still inside it.
struct FramingKeyMarkers: View {
    @ObservedObject var session: EditorSession
    let clip: TimelineClip
    let cellWidth: Double

    var body: some View {
        let keys = VideoFramingTrack.keys(of: clip)
            .filter { $0.at >= clip.sourceStart - 0.001 && $0.at <= clip.sourceEnd + 0.001 }
        TimelineKeyMarkers(
            times: keys.map { $0.at - clip.sourceStart },
            span: clip.duration,
            cellWidth: cellWidth,
            activeTime: activeTime,
            onSelect: { intoClip in
                session.seekToTimelineTime(clipStart + intoClip)
            },
            onMove: { from, to in
                session.moveFramingKey(
                    in: clip,
                    fromSource: clip.sourceStart + from,
                    toSource: clip.sourceStart + to
                )
            },
            onRemove: { intoClip in
                session.removeFramingKey(in: clip, atSource: clip.sourceStart + intoClip)
            }
        )
        .allowsHitTesting(!keys.isEmpty)
    }

    private var clipStart: Double {
        session.project.timelineStart(for: clip.id) ?? 0
    }

    private var activeTime: Double? {
        let intoClip = session.currentTime - clipStart
        guard intoClip >= 0, intoClip <= clip.duration else { return nil }
        return intoClip
    }
}

/// The cutaway flavour: keys are seconds from the overlay's own start, so they
/// travel with it when it is dragged along the timeline.
struct OverlayKeyMarkers: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    let cellWidth: Double

    var body: some View {
        TimelineKeyMarkers(
            times: session.overlayKeys(overlay).map(\.at),
            span: overlay.duration,
            cellWidth: cellWidth,
            activeTime: activeTime,
            onSelect: { at in
                session.seekToTimelineTime(overlay.timelineStart + at)
            },
            onMove: { from, to in
                session.moveOverlayKey(overlay, from: from, to: to)
            },
            onRemove: { at in
                session.removeOverlayKey(overlay, at: at)
            }
        )
        .allowsHitTesting(session.isOverlayKeyed(overlay))
    }

    private var activeTime: Double? {
        let into = session.currentTime - overlay.timelineStart
        guard into >= 0, into <= overlay.duration else { return nil }
        return into
    }
}
