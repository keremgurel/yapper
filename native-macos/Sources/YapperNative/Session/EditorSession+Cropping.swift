import Foundation

/// Opening the crop editor, and writing what it decided.
///
/// Cropping used to live only in a 260-point-wide well inside the overlay
/// inspector, which is where you end up when a control is added beside the
/// thing it edits rather than given room of its own. It is a picture you are
/// aiming at: it wants the window.
@MainActor
extension EditorSession {
    /// Every cutaway made from one file, in the order they appear.
    func overlays(ofMedia mediaID: UUID) -> [ProjectOverlay] {
        (project.overlays ?? [])
            .filter { $0.mediaID == mediaID }
            .sorted { $0.timelineStart < $1.timelineStart }
    }

    /// Opens the editor on one cutaway.
    func beginCropping(overlayID: UUID) {
        guard
            let overlay = (project.overlays ?? []).first(where: { $0.id == overlayID }),
            let media = project.media.first(where: { $0.id == overlay.mediaID })
        else { return }
        cropRequest = CropRequest(
            mediaID: media.id,
            name: media.name,
            overlayIDs: [overlay.id],
            crop: overlay.resolvedCrop
        )
    }

    /// Opens it on a file, which means every cutaway made from that file.
    /// Cropping a screenshot in the bin and having it apply to one of the four
    /// places it appears would be a puzzle, not a feature.
    func beginCropping(mediaID: UUID) {
        guard let media = project.media.first(where: { $0.id == mediaID }) else { return }
        guard
            let request = CropRequest.make(
                mediaID: mediaID,
                name: media.name,
                overlays: overlays(ofMedia: mediaID)
            )
        else {
            setStatus("Put \(media.name) on the timeline before cropping it")
            return
        }
        cropRequest = request
    }

    /// Whether cropping this file would have anything to act on, for the menus
    /// that offer it.
    func canCrop(mediaID: UUID) -> Bool {
        !overlays(ofMedia: mediaID).isEmpty
    }

    func endCropping() {
        cropRequest = nil
    }

    /// Writes a crop to every cutaway the request covers, as one edit.
    func applyCrop(_ crop: OverlayCrop, to request: CropRequest) {
        let clamped = crop.clamped
        let targets = Set(request.overlayIDs)
        guard
            (project.overlays ?? []).contains(where: {
                targets.contains($0.id) && $0.resolvedCrop != clamped
            })
        else { return }
        scheduleCompositionCommit { [self] in
            updateProject { project in
                for index in project.overlays?.indices ?? (0 ..< 0).indices {
                    guard let id = project.overlays?[index].id, targets.contains(id) else { continue }
                    project.overlays?[index].crop = clamped.isFull ? nil : clamped
                }
                project.updatedAt = Date()
            }
            return true
        }
    }
}
