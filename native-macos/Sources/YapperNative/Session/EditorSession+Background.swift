import Foundation

/// Keeping or throwing away the room behind the speaker, and choosing what
/// shows once it is gone.
extension EditorSession {
    /// The clip the background controls act on: the one under the playhead,
    /// which is the same clip the framing controls act on.
    var backgroundClip: TimelineClip? { framingClip }

    var removesBackground: Bool { backgroundClip?.removesBackground ?? false }

    var backdrop: StudioColor { project.resolvedBackdrop }

    /// Keeps only the speaker on this clip, leaving the backdrop showing.
    ///
    /// Per clip rather than per project on purpose: a video is usually one take
    /// that wants it and a cutaway or a screen recording that does not.
    func setBackgroundRemoved(_ removed: Bool) {
        guard let clip = backgroundClip else { return }
        scheduleCompositionCommit(
            successStatus: removed ? "Background removed" : "Background kept"
        ) { [self] in
            guard let index = project.clips.firstIndex(where: { $0.id == clip.id })
            else { return false }
            updateProject { project in
                project.clips[index].backgroundRemoved = removed ? true : nil
                project.updatedAt = Date()
            }
            return true
        }
    }

    /// What fills the frame where there is no picture.
    ///
    /// Rebuilt even while the picker is still streaming, unlike most live
    /// gestures, because the backdrop is only visible in the composition: a
    /// visual-only commit would move the swatch and leave the frame behind.
    /// The commit's own settling time folds the drag into one rebuild.
    func setBackdrop(_ color: StudioColor) {
        guard color != project.resolvedBackdrop else { return }
        scheduleCompositionCommit { [self] in
            updateProject { project in
                // Black is what the frame was filled with before there was a
                // choice, so choosing it is stored as no choice at all.
                project.backdrop = color == .black ? nil : color
                project.updatedAt = Date()
            }
            return true
        }
    }
}
