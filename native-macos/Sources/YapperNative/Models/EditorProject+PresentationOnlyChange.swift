import Foundation

extension EditorProject {
    /// Whether the only things that have changed since `other` are ones the
    /// composition the player is already holding can simply be re-dressed for:
    /// how the clips are framed, whether the room behind the speaker is kept,
    /// what fills the frame behind them, and how loud each track plays.
    ///
    /// This is the licence to take a shortcut. A composition's tracks are built
    /// from the clips' media and source ranges, the cutaways and the audio
    /// layers. Framing is not a track, it is a transform in the video
    /// composition laid over those tracks, and volume is not a track either, it
    /// is a number in the audio mix. So when nothing else has moved, the tracks
    /// the player is holding are still exactly right and only those two need
    /// replacing.
    ///
    /// That is worth a great deal. Swapping the player's item means tearing the
    /// whole playback pipeline down and seeking back to where the playhead was,
    /// and an exact seek in long-GOP footage decodes from the previous keyframe:
    /// the preview goes black for as long as that takes. Handing the item a new
    /// video composition instead keeps the frame on screen.
    ///
    /// Deliberately conservative. Every field that could put a different frame
    /// on screen is compared, and anything this does not understand makes the
    /// answer no, which costs a rebuild that was going to happen anyway.
    func differsOnlyInPresentation(from other: EditorProject) -> Bool {
        guard clips.count == other.clips.count else { return false }
        guard (audioLayers ?? []).count == (other.audioLayers ?? []).count else { return false }
        guard (overlays ?? []).count == (other.overlays ?? []).count else { return false }
        for (mine, theirs) in zip(clips, other.clips) {
            // Everything about a clip except its framing decides what goes into
            // the composition's tracks.
            guard
                mine.id == theirs.id,
                mine.mediaID == theirs.mediaID,
                mine.sourceStart == theirs.sourceStart,
                mine.sourceEnd == theirs.sourceEnd
            else { return false }
        }

        // A layer's volume is a mix number; anything else about it decides what
        // goes into a track, so it has to match.
        for (mine, theirs) in zip(audioLayers ?? [], other.audioLayers ?? []) {
            guard mine.id == theirs.id else { return false }
        }

        // Where an overlay's box sits is a transform in the video composition,
        // the same kind of thing as a clip's framing. What decides the tracks
        // is which media it shows, when it shows it, which lane it is in and
        // whether it is showing at all.
        //
        // This is the difference between nudging a card and rebuilding the
        // whole pipeline. Measured while a creator placed fourteen overlays,
        // 142 of 167 rebuilds tore the player item down and seeked back, at
        // 137 ms each, for changes that moved nothing but a transform.
        for (mine, theirs) in zip(overlays ?? [], other.overlays ?? []) {
            guard
                mine.id == theirs.id,
                mine.mediaID == theirs.mediaID,
                mine.timelineStart == theirs.timelineStart,
                mine.duration == theirs.duration,
                mine.sourceStart == theirs.sourceStart,
                mine.track == theirs.track,
                mine.isHidden == theirs.isHidden,
                mine.keys == theirs.keys
            else { return false }
        }

        var normalised = self
        for index in normalised.clips.indices {
            normalised.clips[index].framing = other.clips[index].framing
            // Cutting the background away is a pass the compositor makes over
            // frames it already has. It changes nothing in a track, so it is
            // not worth blacking the preview out for.
            normalised.clips[index].backgroundRemoved = other.clips[index].backgroundRemoved
        }
        // The colour the frame is filled with before anything is drawn on it.
        normalised.backdrop = other.backdrop
        for index in normalised.audioLayers?.indices ?? (0 ..< 0).indices {
            normalised.audioLayers?[index].volume = other.audioLayers?[index].volume ?? 1
        }
        for index in normalised.overlays?.indices ?? (0 ..< 0).indices {
            guard let theirs = other.overlays?[index] else { return false }
            normalised.overlays?[index].x = theirs.x
            normalised.overlays?[index].y = theirs.y
            normalised.overlays?[index].width = theirs.width
            normalised.overlays?[index].height = theirs.height
            normalised.overlays?[index].crop = theirs.crop
            // Turning a card is the same kind of change as moving it: a
            // different transform over tracks that are already right.
            normalised.overlays?[index].rotation = theirs.rotation
        }
        normalised.videoTrackVolume = other.videoTrackVolume
        // Timestamps move on every edit and mean nothing to the picture.
        normalised.updatedAt = other.updatedAt
        return normalised == other
    }

    /// Whether any fader moved between the two.
    ///
    /// Asked because a new mix handed to a player item that is already running
    /// is not picked up on its own: it takes effect at the next playback cycle,
    /// which for a paused editor is never. Knowing a level changed is what lets
    /// the player be nudged for that and only that.
    func audioLevelsDiffer(from other: EditorProject) -> Bool {
        if resolvedVideoTrackVolume != other.resolvedVideoTrackVolume { return true }
        let mine = (audioLayers ?? []).map { ($0.id, $0.volume) }
        let theirs = (other.audioLayers ?? []).map { ($0.id, $0.volume) }
        guard mine.count == theirs.count else { return true }
        return zip(mine, theirs).contains { $0.0 != $1.0 || $0.1 != $1.1 }
    }
}
