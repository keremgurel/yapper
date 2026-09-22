import Foundation

/// On-screen text layers as actions: add one, change its words or timing.
/// Style is `editor.text.setStyle`; removal is `editor.timeline.delete`.
extension AppActionRegistry {
    func registerTextLayerActions() {
        registerTextLayerAdd()
        registerTextLayerUpdate()
    }

    private func registerTextLayerAdd() {
        register(TextLayerAddInput.self, availability: { session in
            session.duration > 0 ? .available : .init(reason: "Add video before adding text.")
        }) { session, input in
            let asHook = input.asHook == true
            let start: Double
            if asHook {
                start = 0
            } else if let at = input.at {
                start = try TimelineCue.resolve(at, project: session.project, playhead: session.currentTime)
            } else {
                start = session.currentTime
            }
            let span = TextLayerPlacement.span(asHook: asHook, currentTime: start, projectDuration: session.duration)
            let duration = min(input.duration ?? span.duration, max(0.1, session.duration - span.start))
            let layer = ProjectTextLayer(
                text: input.text, timelineStart: span.start, duration: duration,
                y: asHook ? 0.14 : 0.5, width: asHook ? 0.74 : 0.7,
                appearance: asHook ? .hookDefault : .textLayerDefault)
            session.updateProject { project in
                var layers = project.textLayers ?? []
                layers.append(layer)
                project.textLayers = layers
                project.updatedAt = Date()
            }
            return AppActionMutation(message: (asHook ? "Hook added" : "Text added") + " · “\(input.text.prefix(40))”",
                changes: [.init(targetID: layer.id, property: "added", before: "none", after: asHook ? "hook" : "text")],
                afterCommit: {
                    session.selectTextLayer(layer.id)
                    session.requestInspector("Text")
                })
        }
    }

    private func registerTextLayerUpdate() {
        register(TextLayerUpdateInput.self, availability: { session in
            (session.project.textLayers ?? []).isEmpty ? .init(reason: "Add a text layer first.") : .available
        }) { session, input in
            guard let layer = session.project.textLayers?.first(where: { $0.id == input.textLayerID }) else {
                throw AppActionError("A requested text layer no longer exists.")
            }
            guard input.text != nil || input.timelineStart != nil || input.duration != nil else {
                throw AppActionError("Include text, timelineStart or duration.")
            }
            var updated = layer
            if let text = input.text { updated.text = text }
            if let start = input.timelineStart { updated.timelineStart = min(max(0, start), max(0, session.duration - 0.1)) }
            if let duration = input.duration { updated.duration = duration }
            updated.duration = min(updated.duration, max(0.1, session.duration - updated.timelineStart))
            guard updated != layer else { return AppActionMutation(message: "That text layer is already like that.") }
            session.updateProject { project in
                guard let index = project.textLayers?.firstIndex(where: { $0.id == layer.id }) else { return }
                project.textLayers?[index] = updated
                project.updatedAt = Date()
            }
            let changes = try PropertyChanges.diff(targetID: layer.id,
                before: ["text": layer.text, "timelineStart": String(layer.timelineStart), "duration": String(layer.duration)],
                after: ["text": updated.text, "timelineStart": String(updated.timelineStart), "duration": String(updated.duration)])
            return AppActionMutation(message: "Text updated · \(PropertyChanges.fieldNames(changes).joined(separator: ", "))", changes: changes)
        }
    }
}
