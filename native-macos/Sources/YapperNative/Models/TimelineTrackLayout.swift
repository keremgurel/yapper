import Foundation

/// Where every clip on the video track sits, at any moment of a drag.
///
/// The track used to be a row of views whose *membership* changed as the drag
/// went on: the clip being dragged was moved into a second stack so it could
/// float. Moving a view between containers mid-gesture makes SwiftUI tear it
/// down and build it again, and a gesture attached to the view that went away
/// is never told the mouse came up — which is how a drag ended with the drop
/// gap still open and the track stuck like that.
///
/// So position is data now. Every clip keeps its place in the view tree for the
/// whole drag and moves by an offset, and this works out what that offset is.
enum TimelineTrackLayout {
    struct Clip: Equatable, Sendable {
        let id: UUID
        let duration: Double

        init(id: UUID, duration: Double) {
            self.id = id
            self.duration = duration
        }
    }

    /// The drag, as far as the track is concerned.
    struct Drag: Equatable, Sendable {
        /// Clips travelling with the pointer.
        var movingIDs: Set<UUID> = []
        /// Seconds the moving block has been dragged along the track.
        var offset = 0.0
        /// Where the block would drop back in, as an index into the clips that
        /// are staying put. Nil when no reorder is in flight.
        var insertionIndex: Int?
        /// How much room to open at that index.
        ///
        /// Usually the length of the clips being moved, but something arriving
        /// from another track — an overlay being dropped back onto the speaker's
        /// row — owns no clips here yet and brings its own length. Without this
        /// the gap opened nought seconds wide and the track never moved apart.
        var blockDuration: Double?
        /// A clip being carried off the track altogether, onto an overlay lane.
        /// The others close up behind it, because that is what letting go will
        /// actually do.
        var liftedID: UUID?

        static let idle = Drag()
    }

    /// Start times, in seconds, keyed by clip.
    static func positions(clips: [Clip], drag: Drag = .idle) -> [UUID: Double] {
        var natural: [UUID: Double] = [:]
        var cursor = 0.0
        for clip in clips {
            natural[clip.id] = cursor
            cursor += clip.duration
        }

        // Being carried away: the clip holds the spot it came from, since the
        // pointer carries it from there, and the track closes up behind it.
        if let liftedID = drag.liftedID {
            var result: [UUID: Double] = [:]
            var closed = 0.0
            for clip in clips {
                result[clip.id] = closed
                if clip.id != liftedID { closed += clip.duration }
            }
            return result
        }

        // Nothing is being reordered, so everything is where it belongs and
        // anything under the pointer simply rides the offset.
        guard let insertionIndex = drag.insertionIndex else {
            return natural.reduce(into: [:]) { result, entry in
                result[entry.key] = entry.value
                    + (drag.movingIDs.contains(entry.key) ? drag.offset : 0)
            }
        }

        let staying = clips.filter { !drag.movingIDs.contains($0.id) }
        let blockDuration = drag.blockDuration
            ?? clips
                .filter { drag.movingIDs.contains($0.id) }
                .reduce(0) { $0 + $1.duration }

        var result: [UUID: Double] = [:]
        var settled = 0.0
        for (index, clip) in staying.enumerated() {
            // The gap opens where the block would land, so the clips after it
            // slide out of the way instead of being landed on.
            if index == insertionIndex { settled += blockDuration }
            result[clip.id] = settled
            settled += clip.duration
        }

        // The block itself stays locked to the pointer rather than jumping to
        // the gap. The gap is a promise about the drop; the block is the mouse.
        for clip in clips where drag.movingIDs.contains(clip.id) {
            result[clip.id] = (natural[clip.id] ?? 0) + drag.offset
        }
        return result
    }
}
