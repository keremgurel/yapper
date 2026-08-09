@preconcurrency import AppKit
import SwiftUI
import UniformTypeIdentifiers

/// Makes the timeline a place you can drop a file from Finder.
///
/// The landing spot is drawn with the same ghost a clip carried between lanes
/// gets, because it is the same question: which row, and when. Anything else
/// would mean learning the timeline twice.
///
/// A file has no length until it has been read, and reading it while the
/// pointer is still moving would be a disk hit per frame. So the ghost is drawn
/// at a nominal length, and the file is placed at exactly the second that ghost
/// promised: where it goes is the part being aimed at, and that part is never a
/// guess.
struct TimelineExternalDropTarget: ViewModifier {
    @ObservedObject var session: EditorSession
    let contentWidth: Double
    let rowLayout: TimelineRowLayout

    /// What the ghost is drawn from while a file is in the air. Held here
    /// rather than on the drag state, which belongs to items already on the
    /// timeline and is what a drop from outside must not disturb.
    @State private var landing: TimelineLift?

    /// The length a file is assumed to be until it has been read. Long enough
    /// to read as a shot rather than a tick.
    static let assumedDuration = 3.0

    func body(content: Content) -> some View {
        content
            .overlay {
                if let landing {
                    TimelineExternalDropPreview(
                        landing: landing,
                        rows: rowLayout,
                        contentWidth: contentWidth,
                        projectDuration: session.duration
                    )
                }
            }
            .onDrop(
                of: [.fileURL],
                delegate: TimelineFileDropDelegate(
                    moved: { location in
                        landing = lift(at: location)
                    },
                    left: { landing = nil },
                    dropped: { location, urls in
                        // Cleared first, and whatever the drop turned out to be
                        // carrying. A drag that arrives holding nothing this
                        // editor can read is still a drag that has ended.
                        landing = nil
                        guard !urls.isEmpty else { return }
                        let target = target(at: location)
                        Task { await session.importDropped(urls, onto: target, at: target.start) }
                    }
                )
            )
            // The ghost cannot outlive the drag that is drawing it.
            //
            // A drop is not obliged to tell us it is over: `dropExited` is not
            // guaranteed after a drop lands, and a drag abandoned outside the
            // window says nothing at all. Either way the ghost was left painted
            // across the timeline with nothing able to clear it, which is what
            // happened here. Holding a mouse button is a requirement of dragging
            // anything, so no button held means no drag, means no ghost. The
            // loop only runs while there is a ghost to worry about.
            .task(id: landing == nil) {
                guard landing != nil else { return }
                while !Task.isCancelled {
                    try? await Task.sleep(for: .milliseconds(150))
                    guard !Task.isCancelled else { return }
                    guard NSEvent.pressedMouseButtons == 0 else { continue }
                    landing = nil
                    return
                }
            }
    }

    private func lift(at location: CGPoint) -> TimelineLift {
        TimelineLift(
            itemID: UUID(),
            title: "Imported file",
            duration: Self.assumedDuration,
            target: target(at: location)
        )
    }

    /// Where a file let go at `location` would land.
    private func target(at location: CGPoint) -> TimelineDropTarget {
        let time = Self.time(
            atX: location.x,
            contentWidth: contentWidth,
            projectDuration: session.duration
        )
        return TimelineDropGeometry.target(
            pointerY: location.y,
            leadingEdgeTime: time,
            duration: Self.assumedDuration,
            rows: rowLayout,
            stationaryDurations: session.project.clips.map(\.duration),
            projectDuration: session.duration,
            contentWidth: contentWidth,
            snapAnchors: session.timelineSnapAnchors(),
            isSnappingEnabled: session.isTimelineSnappingEnabled,
            // A file from outside is not being lifted out of the edit, so every
            // row is open to it from the first pixel of the drag.
            canLift: true
        )
    }

    static func time(atX x: Double, contentWidth: Double, projectDuration: Double) -> Double {
        guard contentWidth > 0, projectDuration > 0 else { return 0 }
        return min(projectDuration, max(0, x / contentWidth * projectDuration))
    }
}

/// Reports where the pointer is for the whole of a drag, which is the one thing
/// `dropDestination` cannot do: it says whether the pointer is inside, and
/// inside is not an answer to "where would this land".
private struct TimelineFileDropDelegate: DropDelegate {
    let moved: (CGPoint) -> Void
    let left: () -> Void
    let dropped: (CGPoint, [URL]) -> Void

    func validateDrop(info: DropInfo) -> Bool {
        info.hasItemsConforming(to: [.fileURL])
    }

    func dropEntered(info: DropInfo) {
        moved(info.location)
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        moved(info.location)
        // Copy rather than move: the file stays where the creator keeps it, and
        // the project holds a path to it.
        return DropProposal(operation: .copy)
    }

    func dropExited(info: DropInfo) {
        left()
    }

    func performDrop(info: DropInfo) -> Bool {
        let providers = info.itemProviders(for: [.fileURL])
        let location = info.location
        guard !providers.isEmpty else {
            dropped(location, [])
            return false
        }
        Task { @MainActor in
            // One at a time, in the order they were dragged. A drop is a
            // handful of files and reading a URL out of one is nothing, so
            // there is no race here worth arranging for, and the order is worth
            // keeping: it is the order they land in.
            var urls: [URL] = []
            for provider in providers {
                if let url = await Self.url(from: provider) { urls.append(url) }
            }
            // Always reported, empty or not: this is the only place that knows
            // the drag is finished, so it is the only place that can say so.
            dropped(location, urls)
        }
        return true
    }

    /// The file behind one dragged item. A Finder drag carries its URL as data
    /// rather than as a string, and several of them arrive at once, so each is
    /// read on its own and whatever fails is simply not part of the drop.
    private static func url(from provider: NSItemProvider) async -> URL? {
        await withCheckedContinuation { continuation in
            _ = provider.loadDataRepresentation(
                forTypeIdentifier: UTType.fileURL.identifier
            ) { data, _ in
                guard let data, let url = URL(dataRepresentation: data, relativeTo: nil) else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: url)
            }
        }
    }
}

/// The landing spot for a file coming in from outside, drawn exactly like the
/// one for an item already on the timeline.
private struct TimelineExternalDropPreview: View {
    let landing: TimelineLift
    let rows: TimelineRowLayout
    let contentWidth: Double
    let projectDuration: Double

    var body: some View {
        ZStack(alignment: .topLeading) {
            TimelineDropLaneHighlight(lift: landing, rows: rows)
            TimelineDropInsertionLine(lift: landing, rows: rows)
            TimelineDropGhost(
                lift: landing,
                rows: rows,
                contentWidth: contentWidth,
                projectDuration: projectDuration
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .allowsHitTesting(false)
    }
}

extension View {
    /// Lets files be dragged in from Finder and land where they are dropped.
    func timelineExternalDrop(
        session: EditorSession,
        contentWidth: Double,
        rowLayout: TimelineRowLayout
    ) -> some View {
        modifier(
            TimelineExternalDropTarget(
                session: session,
                contentWidth: contentWidth,
                rowLayout: rowLayout
            )
        )
    }
}
