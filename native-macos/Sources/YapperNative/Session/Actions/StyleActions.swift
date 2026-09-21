import Foundation

/// Caption and text layer style as property sets: one action carries any
/// subset of the seventeen style fields, and the same executor serves the
/// inspector's pickers and Chirpy.
extension AppActionRegistry {
    func registerStyleActions() {
        registerCaptionStyle()
        registerTextLayerStyle()
    }

    private func registerCaptionStyle() {
        register(CaptionStyleInput.self, availability: { session in
            session.project.storedCaptions.isEmpty ? .init(reason: "Generate captions before styling them.") : .available
        }) { session, input in
            let patch = try TextStylePatch(input.style)
            guard !patch.isEmpty else { throw AppActionError("Include at least one style field to change.") }
            let ids = Set(input.captionIDs)
            let captions = session.project.storedCaptions
            guard ids.isSubset(of: Set(captions.map(\.id))) else { throw AppActionError("A requested caption no longer exists.") }
            guard input.applyToAll || !ids.isEmpty else { throw AppActionError("Choose captions or set applyToAll.") }

            let before = session.project
            session.updateProject { $0.applyCaptionStyle(patch, applyToAll: input.applyToAll, selection: ids) }
            let after = session.project

            var changes = try PropertyChanges.diff(targetID: before.id, before: before.captionStyleOrDefault,
                                                  after: after.captionStyleOrDefault, prefix: "captionStyle")
            let targets = input.applyToAll ? [] : captions.filter { ids.contains($0.id) }
            let skipped = captions.filter { (input.applyToAll || ids.contains($0.id)) && $0.locked }.map(\.id)
            for caption in targets where !caption.locked {
                guard let updated = after.storedCaptions.first(where: { $0.id == caption.id }) else { continue }
                changes += try PropertyChanges.diff(targetID: caption.id,
                    before: caption.resolvedStyle(base: before.captionStyleOrDefault),
                    after: updated.resolvedStyle(base: after.captionStyleOrDefault), prefix: "style")
            }
            let fields = PropertyChanges.fieldNames(changes).joined(separator: ", ")
            let scope = input.applyToAll ? "all captions" : "\(targets.count) caption\(targets.count == 1 ? "" : "s")"
            return AppActionMutation(
                message: changes.isEmpty ? "Captions already have that style." : "Caption style · \(fields) · \(scope)",
                changes: changes, skippedIDs: skipped)
        }
    }

    private func registerTextLayerStyle() {
        register(TextLayerStyleInput.self, availability: { session in
            (session.project.textLayers ?? []).isEmpty ? .init(reason: "Add a text layer before styling it.") : .available
        }) { session, input in
            let patch = try TextStylePatch(input.style)
            guard !patch.isEmpty else { throw AppActionError("Include at least one style field to change.") }
            let ids = Set(input.textLayerIDs)
            let layers = session.project.textLayers ?? []
            guard ids.isSubset(of: Set(layers.map(\.id))) else { throw AppActionError("A requested text layer no longer exists.") }

            var changes: [AppActionChange] = []
            session.updateProject { project in
                for index in project.textLayers?.indices ?? 0..<0 where ids.contains(project.textLayers![index].id) {
                    let layer = project.textLayers![index]
                    var updated = layer
                    updated.apply(patch)
                    guard updated != layer else { continue }
                    project.textLayers![index] = updated
                    changes += (try? PropertyChanges.diff(targetID: layer.id, before: layer.textStyle,
                                                          after: updated.textStyle, prefix: "style")) ?? []
                }
                if !changes.isEmpty { project.updatedAt = Date() }
            }
            let fields = PropertyChanges.fieldNames(changes).joined(separator: ", ")
            return AppActionMutation(
                message: changes.isEmpty ? "Text already has that style." : "Text style · \(fields) · \(ids.count) layer\(ids.count == 1 ? "" : "s")",
                changes: changes)
        }
    }
}

extension ProjectTextLayer {
    /// The layer's look in the shape the caption inspector already speaks.
    var textStyle: TextStyle {
        TextStyle(x: x, y: y, width: width, rotation: rotation, appearance: appearance)
    }
}
