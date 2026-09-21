import Foundation

/// Per-clip properties on the main track (framing, retouch, background) and
/// the project backdrop. Each executor writes the same fields the inspector
/// does and reports before/after values per clip.
extension AppActionRegistry {
    func registerClipPropertyActions() {
        registerVideoFraming()
        registerClipRetouch()
        registerClipBackground()
        registerProjectBackdrop()
    }

    /// Runs `change` on every requested clip that is not locked, and reports
    /// which clips were skipped. Shared by the three per-clip property sets.
    private func updateClips(
        _ ids: [UUID],
        in session: EditorSession,
        diff: (TimelineClip, TimelineClip) throws -> [AppActionChange],
        change: (inout TimelineClip) -> Void
    ) throws -> (changes: [AppActionChange], skipped: [UUID]) {
        let targets = Set(ids)
        guard targets.isSubset(of: Set(session.project.clips.map(\.id))) else {
            throw AppActionError("A requested clip no longer exists.")
        }
        var changes: [AppActionChange] = []
        var skipped: [UUID] = []
        session.updateProject { project in
            for index in project.clips.indices where targets.contains(project.clips[index].id) {
                let clip = project.clips[index]
                if clip.locked { skipped.append(clip.id); continue }
                var updated = clip
                change(&updated)
                guard updated != clip else { continue }
                project.clips[index] = updated
                changes += (try? diff(clip, updated)) ?? []
            }
            if !changes.isEmpty { project.updatedAt = Date() }
        }
        return (changes, skipped)
    }

    private static func summary(_ what: String, changes: [AppActionChange], skipped: [UUID], unchanged: String) -> String {
        let count = Set(changes.map(\.targetID)).count
        guard count > 0 else {
            return skipped.isEmpty ? unchanged : "Nothing changed; locked clips were skipped."
        }
        return "\(what) · \(count) clip\(count == 1 ? "" : "s")" + (skipped.isEmpty ? "" : " · \(skipped.count) locked skipped")
    }

    private func registerVideoFraming() {
        register(VideoFramingInput.self, availability: { session in
            session.project.clips.contains { !$0.locked && !VideoFramingTrack.isKeyed($0) }
                ? .available : .init(reason: "Select an unlocked clip without framing keyframes.")
        }) { session, input in
            guard input.scale != nil || input.x != nil || input.y != nil || input.rotation != nil else {
                throw AppActionError("Include scale, x, y or rotation.")
            }
            let ids = Set(input.clipIDs)
            if session.project.clips.contains(where: { ids.contains($0.id) && VideoFramingTrack.isKeyed($0) }) {
                throw AppActionError("That clip has framing keyframes. Use editor.video.animateFraming or the keyframe controls instead.")
            }
            let (changes, skipped) = try self.updateClips(input.clipIDs, in: session, diff: { before, after in
                try PropertyChanges.diff(targetID: before.id, before: before.resolvedFraming, after: after.resolvedFraming, prefix: "framing")
            }) { clip in
                let framing = clip.resolvedFraming.with(scale: input.scale, x: input.x, y: input.y, rotation: input.rotation)
                clip.framing = framing.isIdentity ? nil : framing
            }
            let what = input.scale.map { "Framing set to \(Int(($0 * 100).rounded()))%" } ?? "Framing updated"
            return AppActionMutation(message: Self.summary(what, changes: changes, skipped: skipped,
                unchanged: "Clips already have that framing."), changes: changes, skippedIDs: skipped)
        }
    }

    private func registerClipRetouch() {
        register(ClipRetouchInput.self, availability: { session in
            session.project.clips.contains { !$0.locked && session.project.media(for: $0)?.isImage == false }
                ? .available : .init(reason: "Select an unlocked video clip to retouch.")
        }) { session, input in
            guard input.clearBlemishes != nil || input.whitenTeeth != nil else {
                throw AppActionError("Include clearBlemishes or whitenTeeth.")
            }
            let (changes, skipped) = try self.updateClips(input.clipIDs, in: session, diff: { before, after in
                try PropertyChanges.diff(targetID: before.id, before: before.resolvedRetouch, after: after.resolvedRetouch, prefix: "retouch")
            }) { clip in
                let settings = ClipRetouch(clearBlemishes: input.clearBlemishes ?? clip.resolvedRetouch.clearBlemishes,
                                           whitenTeeth: input.whitenTeeth ?? clip.resolvedRetouch.whitenTeeth)
                clip.retouch = settings.isNeutral ? nil : settings
            }
            return AppActionMutation(message: Self.summary("Retouch updated", changes: changes, skipped: skipped,
                unchanged: "Clips already have that retouch."), changes: changes, skippedIDs: skipped)
        }
    }

    private func registerClipBackground() {
        register(ClipBackgroundInput.self, availability: { session in
            session.project.clips.contains { !$0.locked } ? .available : .init(reason: "Select an unlocked clip.")
        }) { session, input in
            let (changes, skipped) = try self.updateClips(input.clipIDs, in: session, diff: { before, after in
                try PropertyChanges.diff(targetID: before.id, before: before.removesBackground, after: after.removesBackground, prefix: "backgroundRemoved")
            }) { clip in
                clip.backgroundRemoved = input.removed ? true : nil
            }
            return AppActionMutation(message: Self.summary(input.removed ? "Background removed" : "Background kept",
                changes: changes, skipped: skipped, unchanged: "Clips already have that background setting."),
                changes: changes, skippedIDs: skipped)
        }
    }

    private func registerProjectBackdrop() {
        register(ProjectBackdropInput.self, availability: { _ in .available }) { session, input in
            guard let color = StudioColor(hex: input.color) else {
                throw AppActionError("color must be a hex colour such as #FF7A21.")
            }
            let before = session.project.resolvedBackdrop
            guard before != color else { return AppActionMutation(message: "The backdrop is already \(color.hex).") }
            session.updateProject { project in
                // Black is what the frame was filled with before there was a
                // choice, so choosing it is stored as no choice at all.
                project.backdrop = color == .black ? nil : color
                project.updatedAt = Date()
            }
            return AppActionMutation(message: "Backdrop \(color.hex)",
                changes: [.init(targetID: session.project.id, property: "backdrop", before: before.hex, after: color.hex)])
        }
    }
}
