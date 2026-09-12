import Foundation

struct SavedMaskOpacityKey: Codable, Equatable, Sendable {
    var time: Double
    var opacity: Double
    var easing: AnimationEase = .linear
}

struct SavedAnimationEvent: Codable, Sendable {
    let id: String
    let overlayID: UUID
    let regionID: String
    let label: String
    let property: String
    let value: Double
    let timelineTime: Double
}

@MainActor
extension EditorSession {
    func animationEvents() async throws -> [SavedAnimationEvent] {
        var events: [SavedAnimationEvent] = []
        for overlay in overlays where overlay.isVisible {
            guard let media = media(for: overlay), media.generated?.revealSourceMediaID != nil else { continue }
            let regions = try await revealRegions(for: media)
            let scene = try SceneExportLayer.loadScene(for: media)
            for region in regions where region.hasMask {
                let keys = region.opacityKeys ?? scene.animations.filter { $0.node == region.id && $0.property == .opacity }
                    .map { SavedMaskOpacityKey(time: $0.end, opacity: $0.to) }
                for (index, key) in keys.enumerated() {
                    let offset = (key.time - overlay.sourceStart) / overlay.resolvedPlaybackRate
                    guard offset >= 0, offset < overlay.duration else { continue }
                    events.append(.init(id: "\(overlay.id.uuidString)/\(region.id)/opacity/\(index)",
                        overlayID: overlay.id, regionID: region.id, label: region.label,
                        property: "opacity", value: key.opacity, timelineTime: overlay.timelineStart + offset))
                }
            }
        }
        return events.sorted { $0.timelineTime < $1.timelineTime }
    }

    func resolveTimelineAnchor(_ anchor: TimelineAnchorInput) async throws -> Double {
        if anchor.kind == .event {
            guard let event = try await animationEvents().first(where: { $0.id == anchor.eventID }) else {
                throw AppActionError("That animation event no longer exists. Read the current edit before trying again.")
            }
            return event.timelineTime + (anchor.offset ?? 0)
        }
        return try TimelineCue.resolve(anchor, project: project, playhead: currentTime)
    }
}

extension AppActionRegistry {
    func registerSoundAt() {
        register(SoundAtInput.self, availability: { session in
            session.duration > 0 ? .available : .init(reason: "Add media before placing audio.")
        }) { session, input in
            guard let effect = SoundEffectDescriptor.effect(id: input.effectID),
                  let url = session.soundEffectService.bundledURL(for: effect) else { throw AppActionError("That sound is not installed.") }
            var layers = session.project.audioLayers ?? []
            var changes: [AppActionChange] = []
            for anchor in input.at {
                let time = try await session.resolveTimelineAnchor(anchor)
                guard time >= 0, time < session.duration else { throw AppActionError("Place audio inside the timeline.") }
                guard !layers.contains(where: { $0.builtInID == effect.id && abs($0.timelineStart - time) < 0.005 }) else { continue }
                let layer = ProjectAudioLayer(url: url, name: effect.name, timelineStart: time,
                    duration: min(effect.duration, session.duration - time), sourceDuration: effect.duration,
                    builtInID: effect.id, sourceKind: .builtIn)
                layers.append(layer)
                changes.append(.init(targetID: layer.id, property: "sound", before: "", after: "\(effect.name) at \(String(format: "%.3f", time))s"))
            }
            if !changes.isEmpty { session.updateProject { $0.audioLayers = layers } }
            return .init(message: changes.isEmpty ? "That audio is already placed." : "Added \(changes.count) audio clips.", changes: changes)
        }
    }
}
