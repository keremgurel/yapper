import CoreGraphics
import Foundation

/// A box a cutaway passes through at one moment of its own life.
///
/// The overlay half of `FramingKey`, and deliberately the same idea in the same
/// shape: mark a moment, move the playhead, drag the card, and the move writes
/// itself. A chart that slides in from the edge or grows as it is talked about
/// is the same gesture as a punch-in, so it should not be a different feature.
///
/// `at` is seconds from the overlay's own start rather than from the start of
/// the video, so dragging a cutaway along the timeline carries its whole
/// animation with it instead of leaving the move behind.
struct OverlayKey: Codable, Equatable, Sendable {
    var at: Double
    var box: OverlayBox
    /// Source window at this key. Older box-only keys inherit the static crop.
    var crop: OverlayCrop?

    init(at: Double, box: OverlayBox, crop: OverlayCrop? = nil) {
        self.at = at
        self.box = box
        self.crop = crop
    }
}

/// Where a cutaway sits over the length of it.
///
/// The same rules as `VideoFramingTrack`: held flat before the first key and
/// after the last, a straight line between them, and every question answered
/// from the keys the overlay carries.
enum OverlayKeyTrack {
    static let minimumGap = 0.02

    static func keys(of overlay: ProjectOverlay) -> [OverlayKey] {
        (overlay.keys ?? []).sorted { $0.at < $1.at }
    }

    static func isKeyed(_ overlay: ProjectOverlay) -> Bool {
        !(overlay.keys ?? []).isEmpty
    }

    static func crop(of overlay: ProjectOverlay, at time: Double) -> OverlayCrop {
        let keys = keys(of: overlay)
        guard let first = keys.first, let last = keys.last else { return overlay.resolvedCrop }
        func resolved(_ key: OverlayKey) -> OverlayCrop { key.crop ?? overlay.resolvedCrop }
        if time <= first.at { return resolved(first) }
        if time >= last.at { return resolved(last) }
        for index in 1..<keys.count where time <= keys[index].at {
            let a = keys[index - 1], b = keys[index]
            let t = max(0, min(1, (time - a.at) / max(0.000001, b.at - a.at)))
            let from = resolved(a), to = resolved(b)
            return OverlayCrop(
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t,
                width: from.width + (to.width - from.width) * t,
                height: from.height + (to.height - from.height) * t
            ).clamped
        }
        return resolved(last)
    }

    static func hasAnimatedCrop(_ overlay: ProjectOverlay) -> Bool {
        let crops = keys(of: overlay).map { $0.crop ?? overlay.resolvedCrop }
        guard let first = crops.first else { return false }
        return crops.dropFirst().contains { $0 != first }
    }

    /// Inserting a key must preserve the visible frame, not jump to the base box.
    static func capturing(at time: Double, in overlay: ProjectOverlay) -> ProjectOverlay {
        setting(box(of: overlay, at: time), at: time, in: overlay,
                crop: crop(of: overlay, at: time))
    }

    /// The box the overlay has `time` seconds into itself.
    static func box(of overlay: ProjectOverlay, at time: Double) -> OverlayBox {
        let still = OverlayBox(
            x: overlay.x,
            y: overlay.y,
            width: overlay.width,
            height: overlay.height
        )
        let keys = keys(of: overlay)
        guard let first = keys.first, let last = keys.last else { return still }
        if time <= first.at { return first.box }
        if time >= last.at { return last.box }

        for (index, key) in keys.enumerated().dropFirst() {
            let previous = keys[index - 1]
            guard time <= key.at else { continue }
            let span = key.at - previous.at
            guard span > 0 else { return key.box }
            return interpolated(
                from: previous.box,
                to: key.box,
                progress: (time - previous.at) / span
            )
        }
        return last.box
    }

    /// The box at a moment of the finished video, for anything that thinks in
    /// timeline seconds rather than in the overlay's own.
    static func box(of overlay: ProjectOverlay, atTimeline time: Double) -> OverlayBox {
        box(of: overlay, at: time - overlay.timelineStart)
    }

    static func interpolated(from: OverlayBox, to: OverlayBox, progress: Double) -> OverlayBox {
        let t = min(1, max(0, progress))
        return OverlayBox(
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
            width: from.width + (to.width - from.width) * t,
            height: from.height + (to.height - from.height) * t
        )
    }

    // MARK: - Editing

    /// The overlay with a key at `time`, replacing one already there.
    ///
    /// The first key takes the box the overlay already has, so marking a moment
    /// never moves anything.
    static func setting(
        _ box: OverlayBox,
        at time: Double,
        in overlay: ProjectOverlay,
        crop: OverlayCrop? = nil
    ) -> ProjectOverlay {
        var updated = overlay
        var keys = keys(of: overlay)
        let capturedCrop = crop ?? self.crop(of: overlay, at: time)
        if let index = keys.firstIndex(where: { abs($0.at - time) < minimumGap }) {
            keys[index].box = box
            keys[index].crop = capturedCrop
        } else {
            keys.append(OverlayKey(at: time, box: box, crop: capturedCrop))
            keys.sort { $0.at < $1.at }
        }
        updated.keys = keys
        // The saved box is what an unkeyed overlay is drawn at, and it follows
        // the first key so that removing every key leaves the card where the
        // move started rather than somewhere nobody chose.
        if let first = keys.first {
            updated.x = first.box.x
            updated.y = first.box.y
            updated.width = first.box.width
            updated.height = first.box.height
        }
        return updated
    }

    static func removingKey(at time: Double, in overlay: ProjectOverlay) -> ProjectOverlay {
        var updated = overlay
        var keys = keys(of: overlay)
        guard let index = keys.firstIndex(where: { abs($0.at - time) < minimumGap }) else {
            return overlay
        }
        let removed = keys.remove(at: index)
        updated.keys = keys.isEmpty ? nil : keys
        let resting = keys.first?.box ?? removed.box
        updated.x = resting.x
        updated.y = resting.y
        updated.width = resting.width
        updated.height = resting.height
        if keys.isEmpty { updated.crop = removed.crop ?? overlay.crop }
        return updated
    }

    /// Every key dropped, the card left where it is at `time`.
    static func clearingKeys(at time: Double, in overlay: ProjectOverlay) -> ProjectOverlay {
        var updated = overlay
        let resting = box(of: overlay, at: time)
        updated.crop = crop(of: overlay, at: time)
        updated.keys = nil
        updated.x = resting.x
        updated.y = resting.y
        updated.width = resting.width
        updated.height = resting.height
        return updated
    }

    /// Rebase keys when a leading edge is trimmed, retaining off-clip keys so
    /// extending it again restores the animation instead of destroying it.
    static func rebased(_ overlay: ProjectOverlay, by offset: Double) -> ProjectOverlay {
        var result = overlay
        result.keys = overlay.keys?.map { key in
            var key = key
            key.at -= offset
            return key
        }
        return result
    }

    /// A split creates two independent value copies, sampled at the cut so
    /// subsequent edits to either portion cannot change the other's boundary.
    static func portion(of overlay: ProjectOverlay, from start: Double, duration: Double) -> ProjectOverlay {
        var result = overlay
        result.timelineStart += start
        result.duration = duration
        guard isKeyed(overlay) else { return result }
        let times = [start] + keys(of: overlay).map(\.at).filter { $0 > start && $0 < start + duration } + [start + duration]
        result.keys = times.map {
            OverlayKey(at: $0 - start, box: box(of: overlay, at: $0), crop: crop(of: overlay, at: $0))
        }
        let first = result.keys![0]
        result.x = first.box.x; result.y = first.box.y
        result.width = first.box.width; result.height = first.box.height
        result.crop = first.crop
        return result
    }

    static func key(of overlay: ProjectOverlay, at time: Double) -> OverlayKey? {
        keys(of: overlay).first { abs($0.at - time) < minimumGap }
    }

    static func previousKey(of overlay: ProjectOverlay, before time: Double) -> OverlayKey? {
        keys(of: overlay).last { $0.at >= 0 && $0.at <= overlay.duration && $0.at < time - minimumGap }
    }

    static func nextKey(of overlay: ProjectOverlay, after time: Double) -> OverlayKey? {
        keys(of: overlay).first { $0.at >= 0 && $0.at <= overlay.duration && $0.at > time + minimumGap }
    }

    /// A key moved along the overlay, for dragging one on the timeline. Kept
    /// inside the overlay and off its neighbours, so a drag can never stack two
    /// keys on one moment or push one past the end of the card.
    static func movingKey(
        at time: Double,
        to destination: Double,
        in overlay: ProjectOverlay
    ) -> ProjectOverlay {
        var keys = keys(of: overlay)
        guard let index = keys.firstIndex(where: { abs($0.at - time) < minimumGap }) else {
            return overlay
        }
        let lower = max(0, index > 0 ? keys[index - 1].at + minimumGap : 0)
        let upper = min(max(0, overlay.duration), index < keys.count - 1
            ? keys[index + 1].at - minimumGap
            : max(0, overlay.duration))
        guard upper > lower else { return overlay }
        keys[index].at = min(upper, max(lower, destination))
        var updated = overlay
        updated.keys = keys.sorted { $0.at < $1.at }
        return updated
    }
}
