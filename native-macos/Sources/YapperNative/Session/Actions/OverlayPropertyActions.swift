import Foundation

extension AppActionRegistry {
    func registerOverlayPropertyActions() {
        register(OverlayFrameInput.self, availability: { _ in .available }) { session, input in
            let targets = try session.actionOverlays(input.overlayIDs, all: input.all == true)
            guard input.fit != nil || input.x != nil || input.y != nil || input.width != nil || input.height != nil || input.rotation != nil else {
                throw AppActionError("Include a fit, size, position or rotation change.")
            }
            guard input.fit == nil || (input.x == nil && input.y == nil && input.width == nil && input.height == nil) else {
                throw AppActionError("Choose a fit preset or explicit frame dimensions, not both.")
            }
            if let time = input.time {
                guard targets.count == 1, time <= targets[0].duration else {
                    throw AppActionError("Choose one overlay and a time inside it for a frame keyframe.")
                }
            }
            let updated = targets.map { overlay in
                input.applying(to: overlay, mediaAspect: session.aspects(for: overlay).media,
                               frameAspect: session.project.resolvedAspectRatio)
            }
            return try session.mutateActionOverlays(updated, message: input.fit == .full ? "Overlays set to full frame" : "Overlay framing saved")
        }
        register(OverlayPropertiesInput.self, availability: { _ in .available }) { session, input in
            guard input.hidden != nil || input.behindSpeaker != nil || input.backdrop != nil || input.backdropColors != nil || input.backdropMediaID != nil || input.sourceStart != nil || input.timelineStart != nil || input.duration != nil || input.track != nil else {
                throw AppActionError("Include an overlay property to change.")
            }
            let targets = try session.actionOverlays(input.overlayIDs, all: input.all == true)
            var updated = try targets.map { overlay in
                guard let media = session.media(for: overlay) else { throw AppActionError("The overlay source is missing.") }
                if input.behindSpeaker == true && media.isScene {
                    throw AppActionError("Generated overlays currently sit in front of the video.")
                }
                var copy = overlay
                if let hidden = input.hidden { copy.isHidden = hidden ? true : nil }
                if let behind = input.behindSpeaker { copy.behindSpeaker = behind ? true : nil }
                if let token = input.backdrop {
                    if token == "image" {
                        guard let id = input.backdropMediaID,
                              let picture = session.project.media.first(where: { $0.id == id }), picture.isImage else {
                            throw AppActionError("An image backdrop needs backdropMediaID: a picture already in the project's media.")
                        }
                        _ = picture
                        copy.backdrop = .image(id)
                    } else {
                        guard token == "none" || OverlayBackdrop(token: token) != nil else {
                            throw AppActionError("Choose none, frosted, image or one of the backdrop presets.")
                        }
                        copy.backdrop = OverlayBackdrop(token: token)
                    }
                } else if input.backdropMediaID != nil {
                    throw AppActionError("Send backdrop: image with backdropMediaID.")
                }
                if let colors = input.backdropColors {
                    guard copy.backdrop?.kind == .preset, let preset = copy.backdrop?.preset else {
                        throw AppActionError("Colours apply to a preset backdrop. Choose a preset first.")
                    }
                    guard colors.count <= preset.defaultColors.count, colors.allSatisfy(BackdropPreset.isHex) else {
                        throw AppActionError("\(preset.title) takes up to \(preset.defaultColors.count) colours as #RRGGBB: \(preset.colorNames.joined(separator: ", ")).")
                    }
                    copy.backdrop?.colors = colors.isEmpty ? nil : preset.resolvedColors(colors)
                }
                if let start = input.timelineStart { copy.timelineStart = start }
                if let duration = input.duration { copy.duration = duration }
                if let start = input.sourceStart { copy.sourceStart = start }
                if let track = input.track { copy.track = track == 0 ? nil : track }
                // The left edge moved rather than the overlay: keyframes stay at
                // the same moments on the timeline, as they do when the edge is
                // dragged. Asked for, never inferred, so a start typed into the
                // inspector still moves the overlay with its keys.
                if input.leadingTrim == true, copy.timelineStart != overlay.timelineStart {
                    copy = OverlayKeyTrack.rebased(copy, by: copy.timelineStart - overlay.timelineStart)
                }
                if input.timelineStart != nil || input.duration != nil || input.sourceStart != nil {
                    guard let fitted = OverlaySpanBounds.fitted(duration: copy.duration, start: copy.timelineStart,
                        sourceStart: copy.sourceStart, mediaDuration: media.isImage ? nil : media.duration,
                        rate: copy.duration > 0 ? copy.sourceDuration / copy.duration : 1,
                        timelineDuration: session.duration) else {
                        throw AppActionError(OverlaySpanBounds.refusal(media: media, sourceStart: copy.sourceStart))
                    }
                    copy.duration = fitted
                }
                return copy
            }
            if input.track != nil || input.timelineStart != nil || input.duration != nil {
                let ids = Set(targets.map(\.id))
                updated = try OverlayLaneFit.settle(updated, among: session.overlays.filter { !ids.contains($0.id) },
                                                    keepingRequestedLane: input.track != nil,
                                                    name: { session.media(for: $0)?.name ?? "That overlay" })
            }
            return try session.mutateActionOverlays(updated, message: "Overlay properties saved")
        }
        register(OverlayAddInput.self, availability: { _ in .available }) { session, input in
            guard session.duration > 0, let media = session.project.media.first(where: { $0.id == input.mediaID }) else {
                throw AppActionError("Choose imported media and add a main-track clip first.")
            }
            let time = try TimelineCue.resolve(input.at, project: session.project, playhead: session.currentTime)
            guard time >= 0, time <= session.duration else { throw AppActionError("Choose a time inside the video.") }
            let start = min(time, max(0, session.duration - 0.1))
            let source = input.sourceStart ?? 0
            let available = media.isImage ? EditorSession.imageClipDefaultDuration : media.duration - source
            let duration: Double
            if let until = input.until {
                // The end is resolved, never computed by the planner: a "while I
                // say X" placement once ran its whole 13.3 s source over two
                // later overlays because the arithmetic was off.
                guard input.duration == nil else { throw AppActionError("Send duration or until, not both.") }
                let end = try TimelineCue.resolveEnd(until, after: start, project: session.project, playhead: session.currentTime)
                duration = min(end, session.duration) - start
                guard duration >= 0.1 else { throw AppActionError("The overlay has to end after it starts.") }
                guard media.isImage || source + duration <= media.duration + OverlaySpanBounds.tolerance else {
                    throw AppActionError("\(media.name) is \(String(format: "%.1f", available)) s long, shorter than the \(String(format: "%.1f", duration)) s it would have to cover. Choose an earlier end or a longer clip.")
                }
            } else {
                duration = input.duration ?? min(session.duration - start, available)
            }
            guard let fitted = OverlaySpanBounds.fitted(duration: duration, start: start, sourceStart: source,
                mediaDuration: media.isImage ? nil : media.duration, timelineDuration: session.duration) else {
                throw AppActionError(OverlaySpanBounds.refusal(media: media, sourceStart: source))
            }
            let overlay = session.introducedOverlay(media: media, timelineStart: start, duration: fitted, sourceStart: source)
            session.updateProject { $0.overlays = ($0.overlays ?? []) + [overlay] }
            return .init(message: "Overlay added · ⌘Z to undo", changes: [.init(targetID: overlay.id, property: "overlay", before: "none", after: media.name)],
                         afterCommit: { session.selectTimelineItem(.overlay(overlay.id)); session.requestInspector("Overlays") })
        }
        register(OverlayTrackInput.self, availability: { _ in .available }) { session, input in
            let targets = OverlayTracks.on(input.track, in: session.overlays)
            guard !targets.isEmpty else { throw AppActionError("That overlay lane no longer exists.") }
            if input.operation == .setHidden {
                guard let hidden = input.hidden else { throw AppActionError("Include whether the lane should be hidden.") }
                return try session.mutateActionOverlays(OverlayTracks.settingHidden(hidden, on: input.track, in: targets), message: hidden ? "Overlay track hidden" : "Overlay track shown")
            }
            let before = session.overlays
            let remaining = OverlayTracks.compacted(before.filter { $0.lane != input.track })
            session.updateProject { $0.overlays = remaining }
            let removed = targets.map { AppActionChange(targetID: $0.id, property: "overlay", before: "present", after: "removed") }
            return .init(message: "Overlay track removed · ⌘Z to undo", changes: removed,
                         afterCommit: { session.reconcileTimelineSelection() })
        }
    }
}

extension EditorSession {
    func actionOverlays(_ ids: [UUID], all: Bool) throws -> [ProjectOverlay] {
        guard !all || ids.isEmpty else { throw AppActionError("Choose all overlays or explicit IDs.") }
        let targets = all ? overlays : try ids.map(actionOverlay)
        guard !targets.isEmpty else { throw AppActionError("Choose at least one existing overlay.") }
        return targets
    }

    func mutateActionOverlays(_ updated: [ProjectOverlay], message: String) throws -> AppActionMutation {
        var changes: [AppActionChange] = []
        for overlay in updated {
            changes += try PropertyChanges.diff(targetID: overlay.id, before: actionOverlay(overlay.id), after: overlay, prefix: "overlay")
        }
        guard !changes.isEmpty else { return .init(message: "Overlays already have those settings.") }
        let replacements = Dictionary(uniqueKeysWithValues: updated.map { ($0.id, $0) })
        updateProject { project in
            project.overlays = (project.overlays ?? []).map { replacements[$0.id] ?? $0 }
            project.updatedAt = Date()
        }
        let count = Set(changes.map(\.targetID)).count
        return .init(message: "\(message) · \(count) overlay\(count == 1 ? "" : "s") · ⌘Z to undo", changes: changes)
    }
}

extension OverlayFrameInput {
    /// The box and angle of `overlay`, onto `ids`: a drag on the canvas, the
    /// inspector, or Apply to all. With `time`, a key on one keyed overlay.
    init(ids: [UUID], frameOf overlay: ProjectOverlay, time: Double?) {
        self.init(overlayIDs: ids, all: nil, fit: nil,
                  x: min(2, max(-2, overlay.x)), y: min(2, max(-2, overlay.y)),
                  width: min(4, max(0.01, overlay.width)), height: min(4, max(0.01, overlay.height)),
                  rotation: time == nil ? min(180, max(-180, overlay.resolvedRotation)) : nil,
                  time: time.map { min(86_400, max(0, $0)) })
    }

    /// Only the angle, which leaves a keyed overlay's move alone.
    init(ids: [UUID], rotation: Double) {
        self.init(overlayIDs: ids, all: nil, fit: nil, x: nil, y: nil, width: nil, height: nil,
                  rotation: min(180, max(-180, rotation)), time: nil)
    }

    /// Whole-span framing changes placement only. Crop keys and their easing
    /// remain byte-for-byte intact, including keys beyond trimmed edges.
    func applying(to overlay: ProjectOverlay, mediaAspect: Double, frameAspect: Double) -> ProjectOverlay {
        func frame(_ original: OverlayBox) -> OverlayBox {
            if fit == .full { return .init(x: 0, y: 0, width: 1, height: 1) }
            if fit == .card {
                let box = OverlayFrame.introduced(mediaAspect: mediaAspect, frameAspect: frameAspect)
                return .init(x: box.x, y: box.y, width: box.width, height: box.height)
            }
            let w = width ?? original.width
            let h = height ?? (width == nil ? original.height : OverlayFrame.height(forWidth: w, mediaAspect: mediaAspect, frameAspect: frameAspect))
            return .init(x: x ?? (original.x + (original.width - w) / 2),
                         y: y ?? (original.y + (original.height - h) / 2), width: w, height: h)
        }
        var updated = overlay
        if let time {
            updated = OverlayKeyTrack.setting(frame(OverlayKeyTrack.box(of: overlay, at: time)), at: time, in: overlay)
        } else {
            let box = frame(.init(x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height))
            updated.x = box.x; updated.y = box.y; updated.width = box.width; updated.height = box.height
            updated.keys = overlay.keys?.map { key in var copy = key; copy.box = frame(key.box); return copy }
        }
        if let rotation { updated.rotation = rotation == 0 ? nil : rotation }
        return updated
    }
}

extension OverlayPropertiesInput {
    /// Visibility, depth, timing and lane, leaving the backdrop alone. A plain
    /// move or edit unless `leadingTrim` says the left edge was dragged.
    init(overlayIDs: [UUID], all: Bool?, hidden: Bool?, behindSpeaker: Bool?, sourceStart: Double?,
         timelineStart: Double?, duration: Double?, track: Int?, leadingTrim: Bool? = nil) {
        self.init(overlayIDs: overlayIDs, all: all, hidden: hidden, behindSpeaker: behindSpeaker, backdrop: nil,
                  backdropColors: nil, backdropMediaID: nil, sourceStart: sourceStart, timelineStart: timelineStart,
                  duration: duration, track: track, leadingTrim: leadingTrim)
    }

    /// Every field but `leadingTrim`: the overlay moves with its keyframes.
    init(overlayIDs: [UUID], all: Bool?, hidden: Bool?, behindSpeaker: Bool?, backdrop: String?, backdropColors: [String]?,
         backdropMediaID: UUID?, sourceStart: Double?, timelineStart: Double?, duration: Double?, track: Int?) {
        self.init(overlayIDs: overlayIDs, all: all, hidden: hidden, behindSpeaker: behindSpeaker, backdrop: backdrop,
                  backdropColors: backdropColors, backdropMediaID: backdropMediaID, sourceStart: sourceStart,
                  timelineStart: timelineStart, duration: duration, track: track, leadingTrim: nil)
    }

    /// What a timeline drag or the lane menu changed on an overlay, or nil
    /// when it changed none of these. `leadingTrim` is the drag on its left
    /// edge, which keeps keyframes where they were on the timeline.
    init?(timingOf updated: ProjectOverlay, from existing: ProjectOverlay, leadingTrim: Bool = false) {
        func changed(_ value: Double, _ old: Double, _ range: ClosedRange<Double>) -> Double? {
            value == old ? nil : min(range.upperBound, max(range.lowerBound, value))
        }
        let hidden = updated.isVisible == existing.isVisible ? nil : !updated.isVisible
        let track = updated.lane == existing.lane ? nil : min(5_000, max(0, updated.lane))
        let sourceStart = changed(updated.sourceStart, existing.sourceStart, 0 ... 86_400)
        let timelineStart = changed(updated.timelineStart, existing.timelineStart, 0 ... 86_400)
        let duration = changed(updated.duration, existing.duration, 0.1 ... 86_400)
        guard hidden != nil || track != nil || sourceStart != nil || timelineStart != nil || duration != nil else { return nil }
        self.init(overlayIDs: [existing.id], all: nil, hidden: hidden, behindSpeaker: nil, sourceStart: sourceStart,
                  timelineStart: timelineStart, duration: duration, track: track,
                  leadingTrim: leadingTrim && timelineStart != nil ? true : nil)
    }
}

extension OverlayTracks {
    static func settingHidden(_ hidden: Bool, on track: Int, in overlays: [ProjectOverlay]) -> [ProjectOverlay] {
        overlays.map { overlay in
            guard overlay.lane == track else { return overlay }
            var updated = overlay; updated.isHidden = hidden ? true : nil; return updated
        }
    }
}
