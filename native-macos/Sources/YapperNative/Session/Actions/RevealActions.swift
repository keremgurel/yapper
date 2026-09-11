import AppKit
import Foundation

struct SavedRevealRegion: Codable, Equatable, Sendable {
    var id: String
    var text: String
    var label: String
    var confidence: Double
    var box: CGRect
    var background: StudioColor
    var policy: RevealPolicy
    /// Time in the saved scene, independent of placement or playback speed.
    var cueTime: Double?
}

struct SavedRevealEvent: Codable, Sendable {
    let id: String
    let overlayID: UUID
    let regionID: String
    let label: String
    let text: String
    let timelineTime: Double
}

@MainActor
extension EditorSession {
    func revealRegions(for media: ProjectMedia) async throws -> [SavedRevealRegion] {
        if let saved = media.generated?.revealRegions { return saved }
        guard media.generated?.revealSourceMediaID != nil else { return [] }
        let scene = try SceneExportLayer.loadScene(for: media)
        // Legacy projects are inspected from their immutable original pixels;
        // reading context never rewrites the scene or re-times its animations.
        let original = media.url.deletingLastPathComponent().appending(path: "image-original.png")
        let prepared = try await ImageNumberRevealService().prepare(original)
        return prepared.regions.enumerated().map { index, region in
            let id = "number-\(index)"
            let animation = scene.animations.first { $0.node == id && $0.property == .opacity && $0.to == 0 }
            return SavedRevealRegion(id: id, text: region.text, label: region.label, confidence: region.confidence,
                box: region.box, background: region.background,
                policy: animation != nil ? .untilCue : scene.nodes.contains { $0.id == id } ? .alwaysHidden : .alwaysVisible,
                cueTime: animation?.start)
        }
    }

    func revealEvents() async throws -> [SavedRevealEvent] {
        var events: [SavedRevealEvent] = []
        for overlay in overlays where overlay.isVisible {
            guard let media = media(for: overlay), media.generated?.revealSourceMediaID != nil else { continue }
            let regions = try await revealRegions(for: media)
            let scene = try SceneExportLayer.loadScene(for: media)
            for region in regions where region.policy == .untilCue {
                guard let animation = scene.animations.first(where: { $0.node == region.id && $0.property == .opacity && $0.to == 0 }) else { continue }
                let offset = (animation.start - overlay.sourceStart) / overlay.resolvedPlaybackRate
                guard offset >= 0, offset < overlay.duration else { continue }
                events.append(.init(id: "\(overlay.id.uuidString)/\(region.id)", overlayID: overlay.id,
                    regionID: region.id, label: region.label, text: region.text,
                    timelineTime: overlay.timelineStart + offset))
            }
        }
        return events.sorted { $0.timelineTime < $1.timelineTime }
    }
}

extension AppActionRegistry {
    func registerRevealActions() {
        register(RevealPolicyInput.self, availability: { session in
            session.project.media.contains { $0.generated?.revealSourceMediaID != nil }
                ? .available : .init(reason: "Create a spoken number reveal first.")
        }) { session, input in
            guard let overlay = session.overlays.first(where: { $0.id == input.overlayID }),
                  let media = session.media(for: overlay), media.generated?.revealSourceMediaID != nil else {
                throw AppActionError("The requested number reveal no longer exists.")
            }
            var regions = try await session.revealRegions(for: media)
            guard Set(input.regions.map(\.regionID)).count == input.regions.count,
                  Set(input.regions.map(\.regionID)).isSubset(of: Set(regions.map(\.id))) else {
                throw AppActionError("A requested number region no longer exists.")
            }
            var scene = try SceneExportLayer.loadScene(for: media)
            var changes: [AppActionChange] = []
            for change in input.regions {
                let index = regions.firstIndex { $0.id == change.regionID }!
                var region = regions[index]
                guard region.policy != change.policy else { continue }
                if change.policy == .untilCue && region.cueTime == nil {
                    throw AppActionError("\(region.label.isEmpty ? region.text : region.label) has no saved spoken cue. Choose a reveal time first.")
                }
                changes.append(.init(targetID: overlay.id, property: "\(region.id).policy", before: region.policy.rawValue, after: change.policy.rawValue))
                scene.nodes.removeAll { $0.id == region.id }
                scene.animations.removeAll { $0.node == region.id }
                if change.policy != .alwaysVisible {
                    var cover = SceneNode(id: region.id, kind: .rect, x: region.box.minX, y: region.box.minY,
                        width: region.box.width, height: region.box.height)
                    cover.fill = .hex(region.background)
                    scene.nodes.append(cover)
                    if change.policy == .untilCue, let at = region.cueTime {
                        scene.animations.append(.init(node: region.id, property: .opacity, from: 1, to: 0,
                            start: at, end: min(scene.duration, at + 0.16), easing: .outCubic))
                    }
                }
                region.policy = change.policy
                regions[index] = region
            }
            guard !changes.isEmpty else { return .init(message: "Those numbers already have the requested visibility.") }
            let root = session.generatedAssetRoot ?? session.projectNavigation.currentPackage?.url ?? ProjectStore.directory
            var versionSource = media
            let shared = session.overlays.filter { $0.mediaID == media.id }.count > 1
            if shared { versionSource.id = UUID(); versionSource.generated?.versions = [] }
            var revised = try await GeneratedOverlayService.save(reply: ["scene": try JSONSerialization.jsonObject(with: scene.encoded())],
                brand: nil, moment: [:], size: CGSize(width: media.width, height: media.height),
                instruction: "Update number visibility", root: root, existing: versionSource)
            revised.generated?.revealRegions = regions
            session.updateProject { project in
                if let index = project.media.firstIndex(where: { $0.id == revised.id }) { project.media[index] = revised }
                else { project.media.append(revised) }
                if shared, let index = project.overlays?.firstIndex(where: { $0.id == overlay.id }) {
                    project.overlays?[index].mediaID = revised.id
                }
            }
            return .init(message: "Updated \(changes.count) number visibility setting\(changes.count == 1 ? "" : "s").", changes: changes)
        }
        register(RevealSoundsInput.self, availability: { session in
            session.overlays.isEmpty ? .init(reason: "There are no reveals to add sounds to.") : .available
        }) { session, input in
            guard let effect = SoundEffectDescriptor.effect(id: input.effectID),
                  let url = session.soundEffectService.bundledURL(for: effect) else { throw AppActionError("That sound is not installed.") }
            let events = try await session.revealEvents()
            guard Set(input.eventIDs).isSubset(of: Set(events.map(\.id))) else { throw AppActionError("A reveal event changed. Read the current reveals before adding sounds.") }
            var layers = session.project.audioLayers ?? []
            var changes: [AppActionChange] = []
            for event in events where input.eventIDs.contains(event.id) {
                guard !layers.contains(where: { $0.builtInID == effect.id && abs($0.timelineStart - event.timelineTime) < 0.005 }) else { continue }
                let layer = ProjectAudioLayer(url: url, name: effect.name, timelineStart: event.timelineTime,
                    duration: min(effect.duration, session.duration - event.timelineTime), sourceDuration: effect.duration,
                    builtInID: effect.id, sourceKind: .builtIn)
                layers.append(layer)
                changes.append(.init(targetID: layer.id, property: "sound", before: "", after: "\(effect.name) at \(String(format: "%.3f", event.timelineTime))s"))
            }
            if !changes.isEmpty { session.updateProject { $0.audioLayers = layers } }
            return .init(message: changes.isEmpty ? "Those reveals already have that sound." : "Added \(changes.count) \(effect.name.lowercased()) sounds at the saved reveals.", changes: changes)
        }
    }
}
