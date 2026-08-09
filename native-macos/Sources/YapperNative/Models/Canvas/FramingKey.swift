import Foundation

/// A framing the picture passes through at one moment.
///
/// Framing on its own is a state: this much zoom, pushed this far off centre,
/// for the whole clip. A punch-in is not a state, it is a move — 100% here,
/// 140% a second and a half later, and everything in between. That is what a
/// keyframe is for, and why the two cannot be the same value.
///
/// `at` is measured in the media's own seconds, not the timeline's. Trimming
/// the head off a clip then leaves a punch-in aimed at the gesture it was aimed
/// at, rather than sliding it onto whatever now happens to be a second and a
/// half in.
struct FramingKey: Codable, Equatable, Sendable {
    var at: Double
    var framing: VideoFraming

    init(at: Double, framing: VideoFraming) {
        self.at = at
        self.framing = framing
    }
}

/// How the main track is framed over the length of a clip.
///
/// Pure arithmetic on the keys a clip carries. Every question the editor asks
/// about a punch-in — what does it look like now, what happens if I drag the
/// handles here, where is the next key — is answered here, so none of it needs
/// a player to be tested.
enum VideoFramingTrack {
    /// Two keys closer together than this are one key. A keyframe a thousandth
    /// of a second from its neighbour is not a move, it is a duplicate nobody
    /// can select separately.
    static let minimumGap = 0.02

    /// The keys a clip carries, in order. Empty when it has never been keyed,
    /// which is every clip until somebody presses the diamond.
    static func keys(of clip: TimelineClip) -> [FramingKey] {
        (clip.framingKeys ?? []).sorted { $0.at < $1.at }
    }

    static func isKeyed(_ clip: TimelineClip) -> Bool {
        !(clip.framingKeys ?? []).isEmpty
    }

    /// How the picture is framed at one moment of the media.
    ///
    /// Held flat before the first key and after the last, so a punch-in that
    /// ends at 140% stays at 140% rather than drifting back on its own. Between
    /// two keys it is a straight line, which is what a push-in looks like and
    /// what `setTransformRamp` can render without a custom compositor.
    static func framing(of clip: TimelineClip, atSource time: Double) -> VideoFraming {
        let keys = keys(of: clip)
        guard let first = keys.first else { return clip.resolvedFraming }
        guard let last = keys.last else { return clip.resolvedFraming }
        if time <= first.at { return first.framing }
        if time >= last.at { return last.framing }

        for (index, key) in keys.enumerated().dropFirst() {
            let previous = keys[index - 1]
            guard time <= key.at else { continue }
            let span = key.at - previous.at
            guard span > 0 else { return key.framing }
            return interpolated(
                from: previous.framing,
                to: key.framing,
                progress: (time - previous.at) / span
            )
        }
        return last.framing
    }

    /// A framing part of the way between two others.
    static func interpolated(
        from: VideoFraming,
        to: VideoFraming,
        progress: Double
    ) -> VideoFraming {
        let t = min(1, max(0, progress))
        return VideoFraming(
            scale: from.scale + (to.scale - from.scale) * t,
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t
        )
    }

    // MARK: - Editing

    /// The clip with a key at `time`, replacing one already there.
    ///
    /// The first key on a clip takes its static framing with it, so pressing
    /// the diamond never changes what is on screen: it only writes down what
    /// was already true, which is what makes the second key a move rather than
    /// a jump.
    static func setting(
        _ framing: VideoFraming,
        atSource time: Double,
        in clip: TimelineClip
    ) -> TimelineClip {
        var updated = clip
        var keys = keys(of: clip)
        if let index = keys.firstIndex(where: { abs($0.at - time) < minimumGap }) {
            keys[index].framing = framing
        } else {
            keys.append(FramingKey(at: time, framing: framing))
            keys.sort { $0.at < $1.at }
        }
        updated.framingKeys = keys
        // The static framing is what a clip with no keys is drawn at, and a
        // keyed clip is drawn from its keys. Leaving the old value behind would
        // make removing the last key jump the picture somewhere nobody asked
        // for, so it follows the first key.
        updated.framing = keys.first?.framing
        return updated
    }

    /// The clip without the key at `time`. Removing the last one leaves the
    /// clip framed exactly as that key had it, rather than snapping back.
    static func removingKey(atSource time: Double, in clip: TimelineClip) -> TimelineClip {
        var updated = clip
        var keys = keys(of: clip)
        guard let index = keys.firstIndex(where: { abs($0.at - time) < minimumGap }) else {
            return clip
        }
        let removed = keys.remove(at: index)
        updated.framingKeys = keys.isEmpty ? nil : keys
        updated.framing = keys.first?.framing ?? removed.framing
        return updated
    }

    /// The clip with every key dropped, framed as it is at `time` so nothing
    /// moves at the moment you are looking at.
    static func clearingKeys(atSource time: Double, in clip: TimelineClip) -> TimelineClip {
        var updated = clip
        updated.framing = framing(of: clip, atSource: time)
        updated.framingKeys = nil
        return updated
    }

    /// Whether there is a key exactly here, for the diamond that has to know
    /// whether it is adding one or taking one away.
    static func key(of clip: TimelineClip, atSource time: Double) -> FramingKey? {
        keys(of: clip).first { abs($0.at - time) < minimumGap }
    }

    /// The nearest key before `time`, for the arrow that walks back to it.
    static func previousKey(of clip: TimelineClip, before time: Double) -> FramingKey? {
        keys(of: clip).last { $0.at < time - minimumGap }
    }

    static func nextKey(of clip: TimelineClip, after time: Double) -> FramingKey? {
        keys(of: clip).first { $0.at > time + minimumGap }
    }

    /// The keys that fall inside a stretch of the media, for drawing them on a
    /// clip that has been trimmed.
    static func keys(of clip: TimelineClip, inSource range: ClosedRange<Double>) -> [FramingKey] {
        keys(of: clip).filter { range.contains($0.at) }
    }
}
