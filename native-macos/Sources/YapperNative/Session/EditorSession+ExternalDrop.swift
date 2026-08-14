import Foundation

/// Files dragged in from Finder and dropped straight onto the timeline.
///
/// The bin's own drop imports and stops there, because the bin is a shelf and
/// putting something on a shelf is the whole errand. A drop on the timeline is
/// a different sentence: the row and the second under the pointer say where the
/// file goes, so it goes there.
extension EditorSession {
    /// Imports what Finder was carrying and places it where it was let go.
    ///
    /// - Parameters:
    ///   - target: the row under the pointer, from `TimelineDropGeometry`.
    ///   - time: where along the timeline the pointer was, already snapped by
    ///     the preview the creator was looking at. Placed exactly there, so
    ///     what lands is what the ghost promised.
    func importDropped(_ urls: [URL], onto target: TimelineDropTarget, at time: Double) async {
        guard !urls.isEmpty else { return }
        guard let rollbackState = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        setBusy(true)
        clearError()
        setStatus("Reading media…")
        defer { setBusy(false) }

        var landed: [String] = []
        var refused = 0
        // Several files dropped at once are laid out one after another rather
        // than stacked on the same second, which is what a drop of a folder's
        // worth of B-roll wants.
        var cursor = max(0, time)
        var insertionIndex = target.videoInsertionIndex ?? 0

        do {
            for url in urls {
                let canonical = url.resolvingSymlinksInPath()
                let kind = TimelineExternalDrop.Kind(url: canonical)
                let landing = TimelineExternalDrop.landing(
                    for: kind,
                    target: target,
                    time: cursor
                )

                switch landing {
                case .unsupported:
                    refused += 1
                case let .audio(start):
                    let sourceDuration = try await soundEffectService.duration(of: canonical)
                    let layerDuration = min(sourceDuration, max(0.02, duration - start))
                    guard layerDuration > 0 else { continue }
                    let layer = ProjectAudioLayer(
                        url: canonical,
                        name: canonical.deletingPathExtension().lastPathComponent,
                        timelineStart: start,
                        duration: layerDuration,
                        sourceDuration: sourceDuration
                    )
                    updateProject { $0.audioLayers = ($0.audioLayers ?? []) + [layer] }
                    selectTimelineItem(.audio(layer.id))
                    cursor = start + layerDuration
                    landed.append(canonical.lastPathComponent)
                case let .overlay(lane, start):
                    let media = try await ingest(canonical)
                    let overlay = ProjectOverlay(
                        mediaID: media.id,
                        timelineStart: min(start, max(0, duration - 0.05)),
                        duration: placedDuration(of: media, from: start),
                        track: lane
                    )
                    updateProject { $0.overlays = ($0.overlays ?? []) + [overlay] }
                    selectTimelineItem(.overlay(overlay.id))
                    cursor = overlay.timelineStart + overlay.duration
                    landed.append(media.name)
                case let .clip(index):
                    let media = try await ingest(canonical)
                    let clip = TimelineClip(
                        mediaID: media.id,
                        sourceStart: 0,
                        sourceEnd: media.duration
                    )
                    updateProject { project in
                        project.clips.insert(clip, at: min(index, project.clips.count))
                    }
                    selectTimelineItem(.clip(clip.id))
                    // The next file goes after this one rather than in front of
                    // it, so a multiple drop keeps the order it was dragged in.
                    insertionIndex = min(insertionIndex + 1, project.clips.count)
                    landed.append(media.name)
                }
            }

            guard !landed.isEmpty else {
                setStatus("That is not a video, an image or a sound this editor can open")
                return
            }
            let success = await commitPreparedTimelineEdit(
                rollbackState: rollbackState,
                successStatus: dropSummary(landed: landed, refused: refused)
            )
            guard success else { return }
        } catch {
            await restoreEditState(rollbackState, rebuildPlayer: true, preserving: error)
        }
    }

    /// Puts a file in the bin, or finds the one already there. Importing the
    /// same file twice would give the project two names for one video.
    private func ingest(_ url: URL) async throws -> ProjectMedia {
        if let existing = project.media.first(where: { $0.url == url }) { return existing }
        let media = try await MediaProbe.inspect(url: url)
        updateProject { $0.media.append(media) }
        return media
    }

    /// How long a cutaway runs for: its own length, cut off by the end of the
    /// edit. A still has no length of its own, so it gets the four seconds the
    /// importer gives one.
    private func placedDuration(of media: ProjectMedia, from start: Double) -> Double {
        let room = max(0.2, duration - start)
        return min(media.duration, room)
    }

    private func dropSummary(landed: [String], refused: Int) -> String {
        let names = landed.count == 1 ? landed[0] : "\(landed.count) files"
        guard refused > 0 else { return "Added \(names) · ⌘Z to undo" }
        return "Added \(names), skipped \(refused) this editor cannot open · ⌘Z to undo"
    }
}
