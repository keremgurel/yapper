import Foundation

extension ActionRect {
    var overlayCrop: OverlayCrop { .init(x: x, y: y, width: width, height: height) }

    func validatedCrop() throws -> OverlayCrop {
        guard x + width <= 1.000001, y + height <= 1.000001,
              width >= OverlayCrop.minimumSide, height >= OverlayCrop.minimumSide else {
            throw AppActionError("Keep the zoom or crop rectangle inside the image and at least 5% wide and high.")
        }
        return overlayCrop
    }
}

extension OverlayCrop {
    var actionRect: ActionRect { .init(x: x, y: y, width: width, height: height) }

    /// Fit the selected region inside a window with the current shape, so a
    /// zoom keeps the overlay's outer frame and the image's proportions.
    func focusWindow(matching original: OverlayCrop) -> OverlayCrop {
        let ratio = original.width / original.height
        let height = min(1, max(self.height, width / ratio))
        let width = min(1, height * ratio)
        let fittedHeight = min(height, width / ratio)
        return OverlayCrop(x: x + self.width / 2 - width / 2,
            y: y + self.height / 2 - fittedHeight / 2,
            width: width, height: fittedHeight).clamped
    }
}

extension AppActionRegistry {
    func registerOverlayActions() {
        register(OverlayZoomInput.self, availability: { session in
            session.overlays.isEmpty ? .init(reason: "Place an overlay first.") : .available
        }) { session, input in
            let overlay = try session.actionOverlay(input.overlayID)
            guard input.endTime - input.startTime >= OverlayKeyTrack.minimumGap,
                  input.endTime <= overlay.duration,
                  (input.returnStart == nil) == (input.returnEnd == nil) else {
                throw AppActionError("Choose a zoom start and end inside the overlay.")
            }
            if let start = input.returnStart, let end = input.returnEnd {
                guard start >= input.endTime + OverlayKeyTrack.minimumGap,
                      end - start >= OverlayKeyTrack.minimumGap, end <= overlay.duration else {
                    throw AppActionError("Place the return after the zoom and before the overlay ends.")
                }
            }
            let before = OverlayKeyTrack.crop(of: overlay, at: input.startTime)
            let target = try input.target.validatedCrop().focusWindow(matching: before)
            var updated = OverlayZoom.applying(to: overlay, from: input.startTime, to: input.endTime,
                                               startCrop: before, endCrop: target)
            if let start = input.returnStart, let end = input.returnEnd {
                updated = OverlayZoom.applying(to: updated, from: start, to: end,
                                               startCrop: target, endCrop: before)
            }
            return session.mutateActionOverlay(updated, message: "Animated zoom saved · edit its diamonds to adjust the move.")
        }
        register(OverlayKeyframeInput.self, availability: { _ in .available }) { session, input in
            let overlay = try session.actionOverlay(input.overlayID)
            guard input.time <= overlay.duration else { throw AppActionError("Place the keyframe inside the overlay.") }
            let updated: ProjectOverlay
            switch input.operation {
            case .set:
                let box = input.box.map { OverlayBox(x: $0.x, y: $0.y, width: $0.width, height: $0.height) }
                    ?? OverlayKeyTrack.box(of: overlay, at: input.time)
                let crop = try input.crop?.validatedCrop()
                updated = OverlayKeyTrack.setting(box, at: input.time, in: overlay, crop: crop)
            case .remove: updated = OverlayKeyTrack.removingKey(at: input.time, in: overlay)
            case .clear: updated = OverlayKeyTrack.clearingKeys(at: input.time, in: overlay)
            case .move:
                guard let destination = input.destination, destination <= overlay.duration else {
                    throw AppActionError("Choose a destination inside the overlay.")
                }
                updated = OverlayKeyTrack.movingKey(at: input.time, to: destination, in: overlay)
            }
            return session.mutateActionOverlay(updated, message: "Overlay keyframes saved.")
        }
        register(OverlayCropInput.self, availability: { _ in .available }) { session, input in
            let crop = try input.crop.validatedCrop()
            let targets = try input.overlayIDs.map { try session.actionOverlay($0) }
            if let time = input.time {
                guard targets.count == 1, let overlay = targets.first, time <= overlay.duration else {
                    throw AppActionError("Choose one overlay and a time inside it for a crop keyframe.")
                }
            }
            var changes: [AppActionChange] = []
            for overlay in targets {
                let request = CropRequest(mediaID: overlay.mediaID, name: "", overlayIDs: [overlay.id],
                                          crop: crop, keyTime: input.time)
                let updated = request.applying(crop, to: [overlay])[0]
                changes += session.mutateActionOverlay(updated, message: "").changes
            }
            return .init(message: changes.isEmpty ? "The crop is already set." : "Overlay crop saved.", changes: changes)
        }
    }
}

@MainActor
extension EditorSession {
    func actionOverlay(_ id: UUID) throws -> ProjectOverlay {
        guard let overlay = overlays.first(where: { $0.id == id }) else {
            throw AppActionError("That overlay no longer exists.")
        }
        return overlay
    }

    func mutateActionOverlay(_ overlay: ProjectOverlay, message: String) -> AppActionMutation {
        guard let before = overlays.first(where: { $0.id == overlay.id }), before != overlay else {
            return .init(message: "That overlay already has those settings.")
        }
        updateProject { project in
            guard let index = project.overlays?.firstIndex(where: { $0.id == overlay.id }) else { return }
            project.overlays?[index] = overlay
        }
        return .init(message: message, changes: [.init(targetID: overlay.id, property: "overlay",
            before: "Previous overlay settings", after: message)], afterCommit: { self.selectedOverlayID = overlay.id })
    }
}

enum OverlayZoom {
    static func applying(to overlay: ProjectOverlay, from start: Double, to end: Double,
                         startCrop: OverlayCrop, endCrop: OverlayCrop) -> ProjectOverlay {
        // Keep every placement key. Only the crop channel changes.
        var result = OverlayKeyTrack.capturing(at: 0, in: overlay)
        result = OverlayKeyTrack.capturing(at: start, in: result)
        result = OverlayKeyTrack.capturing(at: end, in: result)
        var keys = OverlayKeyTrack.keys(of: result)
        for index in keys.indices where keys[index].at >= start && keys[index].at <= end {
            let t = (keys[index].at - start) / (end - start)
            let progress = SceneEasing.inOutCubic.apply(t)
            keys[index].crop = OverlayCrop(x: startCrop.x + (endCrop.x - startCrop.x) * progress,
                y: startCrop.y + (endCrop.y - startCrop.y) * progress,
                width: startCrop.width + (endCrop.width - startCrop.width) * progress,
                height: startCrop.height + (endCrop.height - startCrop.height) * progress)
            if keys[index].at < end {
                keys[index].cropEasing = .init(lower: t, upper: (keys[index + 1].at - start) / (end - start))
            } else { keys[index].cropEasing = nil }
        }
        for index in keys.indices where keys[index].at > end {
            keys[index].crop = endCrop
            keys[index].cropEasing = nil
        }
        result.keys = keys
        return result
    }
}
