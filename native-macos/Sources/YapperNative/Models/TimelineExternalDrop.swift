import Foundation
import UniformTypeIdentifiers

/// What a file dragged in from Finder becomes when it lands on the timeline.
///
/// Importing and placing used to be two errands: drop the file in the media
/// bin, find it there, then carry it onto the timeline and along to the moment
/// you already had in mind when you picked it up. The row and the second under
/// the pointer say both things at once, so a drop can just do them.
///
/// A file cannot always go where it was dropped. An image is not a clip: the
/// main track is footage the speaker is in, and an image belongs over it. A
/// sound is not either, and there is one row for those. So the row under the
/// pointer is a request, and this is the answer.
enum TimelineExternalDrop {
    /// Where a dropped file ends up.
    enum Landing: Equatable, Sendable {
        /// Into the running order of the main track, which is magnetic.
        case clip(insertionIndex: Int)
        /// On a cutaway lane, at a moment.
        case overlay(lane: Int, start: Double)
        /// On the audio row, at a moment.
        case audio(start: Double)
        /// Nothing this editor opens.
        case unsupported
    }

    /// What kind of thing a file is, as far as the timeline cares.
    enum Kind: Equatable, Sendable {
        case video
        case image
        case audio
        case other

        init(url: URL) {
            guard let type = try? url.resourceValues(forKeys: [.contentTypeKey]).contentType else {
                // Unindexed volumes hand back no type, and an SD card straight
                // out of a camera is exactly the case this has to survive.
                switch url.pathExtension.lowercased() {
                case "mp4", "mov", "m4v", "avi", "mkv": self = .video
                case "png", "jpg", "jpeg", "heic", "gif", "webp", "tiff": self = .image
                case "mp3", "wav", "aiff", "aif", "m4a", "caf", "aac": self = .audio
                default: self = .other
                }
                return
            }
            if type.conforms(to: .movie) { self = .video } else if type.conforms(to: .image) {
                self = .image
            } else if type.conforms(to: .audio) {
                self = .audio
            } else {
                self = .other
            }
        }
    }

    /// Where a file goes, given the row it was dropped on.
    ///
    /// - Parameters:
    ///   - target: the row under the pointer and where an item placed by time
    ///     would land, from `TimelineDropGeometry`.
    ///   - time: where the pointer is along the timeline, which is what an
    ///     image or a sound is placed by when the row it landed on cannot take
    ///     it. The magnetic main track has no use for it.
    static func landing(
        for kind: Kind,
        target: TimelineDropTarget,
        time: Double
    ) -> Landing {
        switch kind {
        case .other:
            return .unsupported
        case .audio:
            // There is one audio row, so a sound goes to it from wherever it
            // was let go, rather than being refused for being over the wrong
            // one. What the drop meant is never in doubt.
            return .audio(start: max(0, time))
        case .image:
            // Never a clip: the main track is the speaker, and a still laid
            // into it would be a hole in the video rather than a picture over
            // it. Dropped there it becomes a cutaway at that moment instead.
            let lane = target.overlayLane ?? 0
            return .overlay(lane: lane, start: max(0, target.isOverlay ? target.start : time))
        case .video:
            if let lane = target.overlayLane {
                return .overlay(lane: lane, start: max(0, target.start))
            }
            return .clip(insertionIndex: target.videoInsertionIndex ?? 0)
        }
    }
}
