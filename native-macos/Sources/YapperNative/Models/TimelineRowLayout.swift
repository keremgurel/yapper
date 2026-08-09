import Foundation

/// Where each track sits on the timeline.
///
/// A track exists because something is on it. A project with nothing but
/// footage shows one row, and the others arrive as text, overlays, captions and
/// audio do — so the timeline is only ever as tall as the edit is.
///
/// The rail's labels and the cells beside them both measure from here, so a
/// label always sits next to its own track.
struct TimelineRowLayout: Equatable, Sendable {
    let hasText: Bool
    /// How many overlay lanes are in use. Zero when there are no overlays.
    let overlayTrackCount: Int
    let hasCaptions: Bool
    /// How many audio lanes are in use. Zero when there are no sounds. Sounds
    /// that overlap in time are stacked, the way overlays are: see AudioTracks.
    let audioTrackCount: Int

    /// The ruler at the top, which no track may run under.
    static let rulerHeight = 38.0
    static let textRowHeight = 60.0
    static let overlayRowHeight = 60.0
    static let captionRowHeight = 46.0
    static let videoRowHeight = 88.0
    static let audioRowHeight = 58.0
    /// Breathing room between a row's top and the cell drawn in it.
    static let cellInset = 7.0

    init(
        hasText: Bool = false,
        overlayTrackCount: Int = 0,
        hasCaptions: Bool = false,
        audioTrackCount: Int = 0
    ) {
        self.hasText = hasText
        self.overlayTrackCount = max(0, overlayTrackCount)
        self.hasCaptions = hasCaptions
        self.audioTrackCount = max(0, audioTrackCount)
    }

    var hasOverlays: Bool { overlayTrackCount > 0 }
    var hasAudio: Bool { audioTrackCount > 0 }

    var textRowY: Double { Self.rulerHeight + Self.cellInset }

    var overlayStackTop: Double {
        Self.rulerHeight + (hasText ? Self.textRowHeight : 0)
    }

    /// Lane 0 sits closest to the speaker's own track, and higher lanes stack
    /// upwards, which is the way they composite.
    func overlayRowY(track: Int) -> Double {
        let fromTop = max(0, overlayTrackCount - 1 - max(0, track))
        return overlayStackTop + Double(fromTop) * Self.overlayRowHeight + Self.cellInset
    }

    var overlayStackHeight: Double {
        Double(overlayTrackCount) * Self.overlayRowHeight
    }

    private var captionRowTop: Double { overlayStackTop + overlayStackHeight }

    var captionRowY: Double { captionRowTop + 6 }

    var clipRowY: Double {
        captionRowTop + (hasCaptions ? Self.captionRowHeight : 0) + Self.cellInset
    }

    var audioStackTop: Double {
        clipRowY + Self.videoRowHeight + 6
    }

    /// Lane 0 sits closest to the speaker's own track and the rest stack
    /// downwards, away from the picture. The opposite of the overlay stack,
    /// which grows upwards because a higher lane covers a lower one; sound has
    /// no such order, so it reads better running down the page.
    func audioRowY(track: Int) -> Double {
        audioStackTop + Double(max(0, track)) * Self.audioRowHeight
    }

    var audioStackHeight: Double {
        Double(audioTrackCount) * Self.audioRowHeight
    }

    var playheadHeight: Double {
        clipRowY + Self.videoRowHeight + (hasAudio ? audioStackHeight + 6 : 0) + 12
    }

    /// Tall enough for every row plus a little slack under the last one.
    var contentHeight: Double {
        playheadHeight + 24
    }

    /// Which overlay lane a point belongs to, for a cell dragged up or down the
    /// stack. Above the top lane is the top lane; below lane 0 is lane 0.
    func overlayTrack(atY y: Double) -> Int {
        guard overlayTrackCount > 0 else { return 0 }
        let offset = (y - overlayStackTop) / Self.overlayRowHeight
        let fromTop = Int(offset.rounded(.down))
        let track = overlayTrackCount - 1 - fromTop
        return min(overlayTrackCount - 1, max(0, track))
    }
}
