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
        pausePlayback()
        cropRequest = CropRequest(
            mediaID: media.id,
            name: media.name,
            overlayIDs: [overlay.id],
            crop: OverlayKeyTrack.crop(of: overlay, at: overlayTime(of: overlay)),
            keyTime: media.isPicture ? overlayTime(of: overlay) : nil
        )
    }

    /// Prefer the selected occurrence, then the one at the playhead, then the
    /// first. The sheet lets the creator explicitly switch portions or batch.
    func beginCropping(mediaID: UUID) {
        guard let media = project.media.first(where: { $0.id == mediaID }) else { return }
        let portions = overlays(ofMedia: mediaID)
        guard let chosen = portions.first(where: { $0.id == selectedOverlayID })
            ?? portions.first(where: { isPlayheadOver($0) }) ?? portions.first else {
            setStatus("Put \(media.name) on the timeline before cropping it")
            return
        }
        beginCropping(overlayID: chosen.id)
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
        scheduleCompositionCommit { [self] in
            let previous = project.overlays ?? []
            let updated = request.applying(clamped, to: previous)
            guard updated != previous else { return false }
            updateProject { project in
                project.overlays = updated
                project.updatedAt = Date()
            }
            return true
        }
    }
}
