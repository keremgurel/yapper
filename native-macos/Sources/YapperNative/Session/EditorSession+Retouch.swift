import Foundation

/// The retouch slider, on the clip under the playhead.
extension EditorSession {
    var retouch: ClipRetouch { backgroundClip?.resolvedRetouch ?? .none }

    func setClearBlemishes(_ strength: Double) {
        var updated = retouch
        updated.clearBlemishes = strength
        setRetouch(updated)
    }

    func setWhitenTeeth(_ strength: Double) {
        var updated = retouch
        updated.whitenTeeth = strength
        setRetouch(updated)
    }

    /// A slider fires all the way through a drag and never says when the drag
    /// ended, so this leans on the commit's own settling time to fold a whole
    /// gesture into one rebuild. Retouching means finding a face on every
    /// frame, which is not something to start over at each pixel of travel.
    private func setRetouch(_ settings: ClipRetouch) {
        guard let clip = backgroundClip, settings != clip.resolvedRetouch else { return }
        // A clip at nothing is stored as nothing rather than as two zeroes, so
        // turning the sliders back down leaves the project as it started.
        let stored: ClipRetouch? = settings.isNeutral ? nil : settings
        scheduleCompositionCommit { [self] in
            guard let index = project.clips.firstIndex(where: { $0.id == clip.id })
            else { return false }
            updateProject { project in
                project.clips[index].retouch = stored
                project.updatedAt = Date()
            }
            return true
        }
    }
}
