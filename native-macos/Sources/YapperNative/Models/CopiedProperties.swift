import Foundation

/// One item's look, lifted off it so it can be put onto others.
///
/// A finished edit has dozens of cutaways and hundreds of caption cards, and
/// getting one of them right is work: the position, the width, the crop, the
/// colour. Doing that work again on every other one is not editing. So the look
/// is copied whole and pasted onto whatever is selected, which is the same rule
/// every other tool in this editor follows.
///
/// What travels is the look and nothing else. Timing, lane, media and words are
/// what make an item that item rather than another one, and none of them is
/// here.
enum CopiedProperties: Equatable, Sendable {
    case caption(TextStyle)
    case cutaway(CutawayLook)
    case clip(ClipLook)
    case text(TextStyle)

    /// What the item is called in the menu that pastes it.
    var noun: String {
        switch self {
        case .caption: "caption"
        case .cutaway: "cutaway"
        case .clip: "clip"
        case .text: "text"
        }
    }
}

/// A cutaway's size, position and crop.
struct CutawayLook: Equatable, Sendable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var rotation: Double?
    var crop: OverlayCrop?
    var behindSpeaker: Bool?

    static func of(_ overlay: ProjectOverlay) -> CutawayLook {
        CutawayLook(
            x: overlay.x,
            y: overlay.y,
            width: overlay.width,
            height: overlay.height,
            rotation: overlay.rotation,
            crop: overlay.crop,
            behindSpeaker: overlay.behindSpeaker
        )
    }

    /// Written onto another cutaway. One that moves under its own keys keeps
    /// its box, for the reason `ApplyToAll` gives: a move is two moments and
    /// the line between them, and one box cannot say that.
    func applied(to overlay: ProjectOverlay) -> ProjectOverlay {
        var copy = overlay
        copy.crop = crop
        copy.behindSpeaker = behindSpeaker
        guard !OverlayKeyTrack.isKeyed(overlay) else { return copy }
        copy.x = x
        copy.y = y
        copy.width = width
        copy.height = height
        copy.rotation = rotation
        return copy
    }
}

/// A clip's framing and whether its background is taken out.
struct ClipLook: Equatable, Sendable {
    var framing: VideoFraming?
    var backgroundRemoved: Bool?

    static func of(_ clip: TimelineClip) -> ClipLook {
        ClipLook(
            framing: VideoFramingTrack.isKeyed(clip) ? nil : clip.resolvedFraming,
            backgroundRemoved: clip.backgroundRemoved
        )
    }

    func applied(to clip: TimelineClip) -> TimelineClip {
        var copy = clip
        copy.backgroundRemoved = backgroundRemoved
        guard !VideoFramingTrack.isKeyed(clip), let framing else { return copy }
        copy.framing = framing.isIdentity ? nil : framing
        return copy
    }
}
