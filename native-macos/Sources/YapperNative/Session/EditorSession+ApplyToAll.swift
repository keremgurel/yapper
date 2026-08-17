import Foundation

/// Copying one clip's or one overlay's settings onto the rest of them.
///
/// One action per group of settings, each named for exactly what it copies, so
/// nothing has to be guessed from a button called "apply to all". The rules
/// themselves live in `ApplyToAll`; this is the part that commits them and says
/// what happened.
extension EditorSession {
    /// How many other clips are on the main track. Nothing here is worth
    /// offering when the answer is none.
    var otherClipCount: Int { max(0, project.clips.count - 1) }

    /// How many overlays a copy from this one would land on, at each reach.
    ///
    /// Both counts are read from `ApplyToAll.targets`, which is also what does
    /// the copying, so the number on the menu item is the number that changes.
    func overlayTargetCount(
        from overlay: ProjectOverlay,
        scope: ApplyToAll.OverlayScope
    ) -> Int {
        ApplyToAll.targets(from: overlay, in: overlays, scope: scope).count
    }

    /// Gives every clip the framing of the one under the playhead. Keyed clips
    /// keep their move: see `ApplyToAll`.
    func applyFramingToAllClips() {
        guard let clip = framingClip else { return }
        let framing = clip.resolvedFraming
        let updated = ApplyToAll.framing(framing, to: project.clips)
        let changed = ApplyToAll.changeCount(from: project.clips, to: updated)
        let keyed = project.clips.filter { VideoFramingTrack.isKeyed($0) }.count
        guard changed > 0 else { return }

        scheduleCompositionCommitResolvingStatus { [self] in
            updateProject { project in
                project.clips = ApplyToAll.framing(framing, to: project.clips)
                project.updatedAt = Date()
            }
            return Self.status(
                "Scale and position",
                changed: changed,
                noun: "clip",
                skipped: keyed,
                because: "keyframed"
            )
        }
    }

    /// Gives every clip the background setting of the one under the playhead.
    func applyBackgroundToAllClips() {
        guard let clip = backgroundClip else { return }
        let removed = clip.removesBackground
        let updated = ApplyToAll.background(removed: removed, to: project.clips)
        let changed = ApplyToAll.changeCount(from: project.clips, to: updated)
        guard changed > 0 else { return }

        scheduleCompositionCommitResolvingStatus { [self] in
            updateProject { project in
                project.clips = ApplyToAll.background(removed: removed, to: project.clips)
                project.updatedAt = Date()
            }
            return Self.status(
                removed ? "Background removal" : "Background kept",
                changed: changed,
                noun: "clip"
            )
        }
    }

    /// Gives the overlays in reach the size and position of this one. Keyed
    /// overlays keep their move, for the same reason keyed clips do.
    func applyOverlayFrame(
        of overlay: ProjectOverlay,
        scope: ApplyToAll.OverlayScope
    ) {
        let updated = ApplyToAll.frame(of: overlay, to: overlays, scope: scope)
        let changed = ApplyToAll.changeCount(from: overlays, to: updated)
        let keyed = overlays
            .filter { $0.id != overlay.id && scope.covers($0, from: overlay) }
            .count { OverlayKeyTrack.isKeyed($0) }
        guard changed > 0 else { return }

        scheduleCompositionCommitResolvingStatus { [self] in
            updateProject { project in
                project.overlays = ApplyToAll.frame(
                    of: overlay,
                    to: project.overlays ?? [],
                    scope: scope
                )
                project.updatedAt = Date()
            }
            return Self.status(
                "Size and position",
                changed: changed,
                noun: "overlay",
                where: scope == .lane ? " on lane \(overlay.lane + 1)" : "",
                skipped: keyed,
                because: "keyframed"
            )
        }
    }

    /// "Size and position applied to 3 overlays on lane 2 · 1 keyframed left
    /// alone", and the singular of each. Said out loud because a copy that
    /// quietly skipped things would otherwise look like a copy that had not
    /// worked.
    private static func status(
        _ what: String,
        changed: Int,
        noun: String,
        where scope: String = "",
        skipped: Int = 0,
        because reason: String = ""
    ) -> String {
        var text = "\(what) applied to \(changed) \(changed == 1 ? noun : noun + "s")\(scope)"
        if skipped > 0 {
            text += " · \(skipped) \(reason) left alone"
        }
        return text
    }
}
