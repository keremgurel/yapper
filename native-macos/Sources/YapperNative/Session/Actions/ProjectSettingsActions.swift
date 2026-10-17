import Foundation

extension AppActionRegistry {
    func registerProjectSettings() {
        register(ProjectSettingsInput.self, availability: { _ in .available }) { session, input in
            guard input.aspectRatio != nil || input.filter != nil || input.filterStrength != nil || input.videoHidden != nil || input.videoMuted != nil else {
                throw AppActionError("Include a project setting to change.")
            }
            let before = session.project
            var after = before
            if let aspect = input.aspectRatio { after.aspectRatio = aspect.projectAspect }
            if input.filter != nil || input.filterStrength != nil {
                let filter = VisualFilter(id: input.filter.flatMap { VisualFilterID(rawValue: $0.rawValue) } ?? before.resolvedVisualFilter.id,
                                          strength: input.filterStrength ?? before.resolvedVisualFilter.strength)
                after.visualFilter = filter.isNeutral && filter.id == .original ? nil : filter
            }
            if let hidden = input.videoHidden { after.videoTrackHidden = hidden ? true : nil }
            if let muted = input.videoMuted { after.videoTrackMuted = muted ? true : nil }
            var changes: [AppActionChange] = []
            changes += try PropertyChanges.diff(targetID: before.id, before: before.selectedAspectRatio, after: after.selectedAspectRatio, prefix: "aspectRatio")
            changes += try PropertyChanges.diff(targetID: before.id, before: before.resolvedVisualFilter, after: after.resolvedVisualFilter, prefix: "filter")
            changes += try PropertyChanges.diff(targetID: before.id, before: before.isVideoTrackHidden, after: after.isVideoTrackHidden, prefix: "videoHidden")
            changes += try PropertyChanges.diff(targetID: before.id, before: before.isVideoTrackMuted, after: after.isVideoTrackMuted, prefix: "videoMuted")
            guard !changes.isEmpty else { return .init(message: "The project already has those settings.") }
            after.updatedAt = Date()
            session.updateProject { $0 = after }
            return .init(message: "Project settings saved · ⌘Z to undo", changes: changes,
                         afterCommit: { session.gradedOverlayImages.removeAll() })
        }
    }
}

extension ProjectAspectInput {
    var projectAspect: ProjectAspectRatio {
        switch self {
        case .original: .source
        case .portrait: .portrait
        case .feedPortrait: .feedPortrait
        case .square: .square
        case .landscape: .landscape
        }
    }
}
