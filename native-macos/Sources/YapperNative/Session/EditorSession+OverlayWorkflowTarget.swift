import Foundation

/// What Chirpy's overlay request comes to in this project.
///
/// The planner reads the project and names the job and the files; this only
/// checks them against what is really here. Nothing is read out of the
/// sentence, so the same request does the same thing however it was worded.
enum OverlayWorkflowTarget: Equatable {
    case place([ProjectMedia])
    case create
    case revise([ProjectMedia])
    case revealNumbers(ProjectMedia)
}

@MainActor
extension EditorSession {
    /// Decided before anything is transcribed or paid for, so a request with
    /// nothing to act on is answered at once.
    func overlayWorkflowTarget(for request: OverlayWorkflowInput) throws -> OverlayWorkflowTarget {
        let ids = Set(request.mediaIDs ?? [])
        switch request.mode {
        case .create:
            return .create
        case .placeImported:
            let unused = placeableMedia.filter { !isOnTimelineAsOverlay($0) }
            let files = ids.isEmpty ? unused : unused.filter { ids.contains($0.id) }
            guard files.isEmpty else { return .place(files) }
            if placeableMedia.isEmpty { throw AppActionError("Import the overlays you want placed first.") }
            throw AppActionError(ids.isEmpty
                ? "Everything you imported is already on the timeline, so nothing was placed again."
                : "Those files are already on the timeline, so nothing was placed again.")
        case .revise:
            let scenes = project.media.filter { $0.isScene && ids.contains($0.id) }
            guard !scenes.isEmpty else { throw AppActionError("Choose the generated overlay to change.") }
            return .revise(scenes)
        case .revealNumbers:
            // The image itself, or the spoken reveal already made from it.
            let sources = Set(project.media.filter { ids.contains($0.id) }.compactMap { media in
                media.generated?.revealSourceMediaID ?? (media.isImage && !media.isScene ? media.id : nil)
            })
            guard sources.count == 1, let source = placeableMedia.first(where: { sources.contains($0.id) }) else {
                throw AppActionError("Choose one image overlay whose numbers should appear as you say them.")
            }
            return .revealNumbers(source)
        }
    }

    /// True for a file already showing as an overlay, or whose spoken reveal
    /// is. Placing either again is how one screenshot ends up stacked twice.
    private func isOnTimelineAsOverlay(_ media: ProjectMedia) -> Bool {
        overlays.contains { overlay in
            overlay.mediaID == media.id || self.media(for: overlay)?.generated?.revealSourceMediaID == media.id
        }
    }
}
