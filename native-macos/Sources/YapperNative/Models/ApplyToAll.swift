import Foundation

/// Copying one clip's settings onto the rest of them, as arithmetic.
///
/// A finished edit is dozens of clips that were one recording an hour ago, so
/// wanting them framed alike is the normal case rather than the exception. What
/// is never wanted is *everything* alike, which is what a single button called
/// "apply to all" quietly promises.
///
/// So this is one function per group of settings, each copying exactly what it
/// is named for. Keyframes are in none of them: a move is two moments and the
/// line between them, the clip three cuts later has no use for the same one,
/// and writing a framing onto a keyed clip would either be ignored or take the
/// move out.
///
/// Kept apart from the session so it can be checked without one.
enum ApplyToAll {
    /// How far a copy reaches across the overlay lanes.
    ///
    /// Lanes are how a project stays legible once it has more than a couple of
    /// cutaways in it: one lane of talking-head inserts, another of screen
    /// recordings, a third of logos. Those want to match each other and do not
    /// want to match across, so the lane is the default reach and the whole
    /// project is the one you have to ask for.
    enum OverlayScope: Equatable, Sendable {
        /// Only the overlays sharing this one's lane.
        case lane
        /// Every overlay in the project, whatever lane it sits on.
        case project
        /// The overlays picked out by hand, which is what a marquee across the
        /// timeline leaves behind. Moving one of them moves the set.
        case selection(Set<UUID>)

        /// Whether `other` is in reach of a copy from `overlay`.
        func covers(_ other: ProjectOverlay, from overlay: ProjectOverlay) -> Bool {
            switch self {
            case .lane: other.lane == overlay.lane
            case .project: true
            case let .selection(ids): ids.contains(other.id)
            }
        }
    }

    /// Every clip given `framing`, except the ones whose framing is the result
    /// of their own keys.
    ///
    /// - Parameter ids: the clips to land on, or nil for all of them. A
    ///   selection is how a creator says "these ones and not the rest".
    static func framing(
        _ framing: VideoFraming,
        to clips: [TimelineClip],
        ids: Set<UUID>? = nil
    ) -> [TimelineClip] {
        clips.map { clip in
            guard ids?.contains(clip.id) ?? true, !VideoFramingTrack.isKeyed(clip) else { return clip }
            var copy = clip
            copy.framing = framing.isIdentity ? nil : framing
            return copy
        }
    }

    static func background(removed: Bool, to clips: [TimelineClip]) -> [TimelineClip] {
        clips.map { clip in
            var copy = clip
            copy.backgroundRemoved = removed ? true : nil
            return copy
        }
    }

    /// The overlays in reach of a copy from `overlay`, not counting `overlay`
    /// itself and not counting the ones that move under their own keys.
    ///
    /// The count the button shows and the set the copy lands on are the same
    /// list, asked for in one place, so a menu item promising three overlays
    /// cannot change two.
    static func targets(
        from overlay: ProjectOverlay,
        in overlays: [ProjectOverlay],
        scope: OverlayScope
    ) -> [ProjectOverlay] {
        overlays.filter { other in
            other.id != overlay.id
                && scope.covers(other, from: overlay)
                && !OverlayKeyTrack.isKeyed(other)
        }
    }

    /// Every overlay in reach given this one's size and position, except the
    /// ones that move under their own keys.
    ///
    /// Size and position only. An overlay's timing, its crop, its lane and its
    /// media are what make it that overlay rather than another one.
    static func frame(
        of overlay: ProjectOverlay,
        to overlays: [ProjectOverlay],
        scope: OverlayScope
    ) -> [ProjectOverlay] {
        overlays.map { other in
            guard other.id != overlay.id,
                  scope.covers(other, from: overlay),
                  !OverlayKeyTrack.isKeyed(other)
            else { return other }
            var copy = other
            copy.x = overlay.x
            copy.y = overlay.y
            copy.width = overlay.width
            copy.height = overlay.height
            return copy
        }
    }

    /// How many of `clips` a copy would actually change, which is what decides
    /// whether the action is worth doing and what the status line says.
    static func changeCount<T: Equatable>(from before: [T], to after: [T]) -> Int {
        guard before.count == after.count else { return after.count }
        return zip(before, after).count { $0 != $1 }
    }
}
