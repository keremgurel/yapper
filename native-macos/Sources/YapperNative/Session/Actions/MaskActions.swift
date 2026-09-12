import AppKit
import Foundation

extension AppActionRegistry {
    func registerMaskActions() {
        register(MaskRegionInput.self, availability: { _ in .available }) { session, input in
            let overlay = try session.actionOverlay(input.overlayID)
            guard let media = session.media(for: overlay), media.isImage else {
                throw AppActionError("Choose an image or generated overlay to mask.")
            }
            guard input.rect.x + input.rect.width <= 1.000001,
                  input.rect.y + input.rect.height <= 1.000001 else {
                throw AppActionError("Keep the mask inside the image.")
            }
            var regions = media.isScene ? try await session.revealRegions(for: media) : []
            let existing = input.regionID.flatMap { id in regions.first { $0.id == id } }
            if input.regionID != nil && existing == nil { throw AppActionError("That mask no longer exists.") }
            guard existing != nil || regions.count < 32 else { throw AppActionError("This overlay already has 32 masks.") }
            let cue = input.revealTime.map { overlay.sourceStart + $0 * overlay.resolvedPlaybackRate }
                ?? existing?.cueTime
            if input.policy == .untilCue {
                guard let cue, cue >= overlay.sourceStart,
                      (cue - overlay.sourceStart) / overlay.resolvedPlaybackRate < overlay.duration else {
                    throw AppActionError("Choose a reveal time inside this overlay.")
                }
            }
            let region = SavedRevealRegion(id: existing?.id ?? "mask-\(UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: "").prefix(16))",
                text: existing?.text ?? "", label: input.label, confidence: existing?.confidence ?? 1,
                box: CGRect(x: input.rect.x, y: input.rect.y, width: input.rect.width, height: input.rect.height),
                background: .init(red: input.red, green: input.green, blue: input.blue), policy: input.policy, cueTime: cue)
            guard region != existing else { return .init(message: "That mask already has those settings.") }
            var scene: OverlayScene
            var images: [[String: String]] = []
            if media.isScene {
                scene = try SceneExportLayer.loadScene(for: media)
            } else {
                let length = overlay.sourceStart + overlay.duration * overlay.resolvedPlaybackRate
                guard SceneLimits.duration.contains(length) else {
                    throw AppActionError("Split this image into a portion between half a second and 30 seconds before masking it.")
                }
                guard let bitmap = NSBitmapImageRep(data: try Data(contentsOf: media.url)),
                      let data = bitmap.representation(using: .png, properties: [:]) else {
                    throw AppActionError("The original image could not be read.")
                }
                scene = ImageNumberReveal.scene(regions: [], cues: [], start: 0, duration: length)
                images = [["key": "original", "data": data.base64EncodedString()]]
            }
            if input.policy == .untilCue, let cue, cue >= scene.duration {
                throw AppActionError("The reveal time extends beyond the saved scene.")
            }
            if let index = regions.firstIndex(where: { $0.id == region.id }) { regions[index] = region }
            else { regions.append(region) }
            scene.setMask(region)
            try await session.saveMaskScene(scene, regions: regions, media: media, overlay: overlay, images: images)
            return .init(message: "Mask saved · adjust its region or reveal time in the overlay inspector.",
                         changes: [.init(targetID: overlay.id, property: "\(region.id).mask", before: existing == nil ? "None" : "Previous mask", after: region.policy.rawValue)])
        }
        register(MaskRemoveInput.self, availability: { _ in .available }) { session, input in
            let overlay = try session.actionOverlay(input.overlayID)
            guard let media = session.media(for: overlay), media.isScene else { throw AppActionError("That overlay has no masks.") }
            var regions = try await session.revealRegions(for: media)
            guard regions.contains(where: { $0.id == input.regionID }) else { throw AppActionError("That mask no longer exists.") }
            regions.removeAll { $0.id == input.regionID }
            var scene = try SceneExportLayer.loadScene(for: media)
            scene.nodes.removeAll { $0.id == input.regionID }
            scene.animations.removeAll { $0.node == input.regionID }
            try await session.saveMaskScene(scene, regions: regions, media: media, overlay: overlay)
            return .init(message: "Mask removed.", changes: [.init(targetID: overlay.id, property: "mask", before: input.regionID, after: "Removed")])
        }
    }
}

extension OverlayScene {
    mutating func setMask(_ region: SavedRevealRegion) {
        nodes.removeAll { $0.id == region.id }
        animations.removeAll { $0.node == region.id }
        guard region.policy != .alwaysVisible else { return }
        var cover = SceneNode(id: region.id, kind: .rect, x: region.box.minX, y: region.box.minY,
                              width: region.box.width, height: region.box.height)
        cover.fill = .hex(region.background)
        nodes.append(cover)
        if region.policy == .untilCue, let at = region.cueTime {
            animations.append(.init(node: region.id, property: .opacity, from: 1, to: 0,
                                    start: at, end: min(duration, at + 0.16), easing: .outCubic))
        }
    }
}

@MainActor
extension EditorSession {
    func saveMaskScene(_ scene: OverlayScene, regions: [SavedRevealRegion], media: ProjectMedia,
                       overlay: ProjectOverlay, images: [[String: String]] = []) async throws {
        let root = generatedAssetRoot ?? projectNavigation.currentPackage?.url ?? ProjectStore.directory
        let shared = overlays.filter { $0.mediaID == media.id }.count > 1
        var source = media
        if shared { source.id = UUID(); source.generated?.versions = [] }
        var reply: [String: Any] = ["scene": try JSONSerialization.jsonObject(with: scene.encoded())]
        if !images.isEmpty { reply["images"] = images }
        if !media.isScene { reply["name"] = "\(media.name) · masked" }
        var revised = try await GeneratedOverlayService.save(reply: reply, brand: nil, moment: [:],
            size: CGSize(width: media.width, height: media.height), instruction: "Edit image masks",
            root: root, existing: media.isScene ? source : nil)
        let saved = try SceneExportLayer.loadScene(for: revised)
        for region in regions where region.policy != .alwaysVisible {
            guard saved.nodes.contains(where: { $0.id == region.id }),
                  region.policy != .untilCue || saved.animations.contains(where: {
                      $0.node == region.id && $0.property == .opacity && $0.to == 0
                  }) else { throw AppActionError("The mask could not be saved with its reveal timing. Nothing was changed.") }
        }
        revised.generated?.revealSourceMediaID = media.generated?.revealSourceMediaID ?? media.id
        revised.generated?.revealRegions = regions
        try Task.checkCancellation()
        updateProject { project in
            if let index = project.media.firstIndex(where: { $0.id == revised.id }) { project.media[index] = revised }
            else { project.media.append(revised) }
            if let index = project.overlays?.firstIndex(where: { $0.id == overlay.id }) {
                project.overlays?[index].mediaID = revised.id
            }
        }
    }
}
