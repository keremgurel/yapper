@preconcurrency import AVFoundation
import AppKit
import Combine
import CoreGraphics
import Foundation

struct EditorInspectorRequest: Equatable, Sendable {
    let id = UUID()
    let tool: String
}

@MainActor
final class EditorSession: ObservableObject {
    @Published private(set) var project = EditorProject()
    @Published var selectedClipID: UUID?
    @Published var selectedTextLayerID: UUID?
    @Published var selectedAudioLayerID: UUID?
    @Published var selectedOverlayID: UUID?
    @Published private(set) var timelineSelection: Set<TimelineSelectionItem> = []
    @Published private(set) var timelineSelectionDragDelta = 0.0
    @Published private(set) var inspectorRequest: EditorInspectorRequest?
    @Published private(set) var currentTime = 0.0
    @Published private(set) var isPlaying = false
    @Published private(set) var isBusy = false
    @Published private(set) var isExporting = false
    @Published private(set) var isAIEditing = false
    @Published private(set) var aiProgress = 0.0
    @Published private(set) var statusMessage = "Import video to begin"
    @Published private(set) var errorMessage: String?
    @Published private(set) var waveformByMedia: [UUID: [Float]] = [:]
    @Published private(set) var waveformProgressByMedia: [UUID: Double] = [:]
    @Published private(set) var thumbnailsByMedia: [UUID: [CGImage]] = [:]
    @Published var isTimelineSnappingEnabled: Bool {
        didSet { UserDefaults.standard.set(isTimelineSnappingEnabled, forKey: "timelineSnappingEnabled") }
    }
    @Published private(set) var activeTimelineSnap: TimelineSnapMatch?

    let player = AVPlayer()

    private let store = ProjectStore.shared
    private let waveformService = WaveformService()
    private let thumbnailService = ThumbnailService()
    private let aiEditService = AIEditService()
    private let soundEffectService = SoundEffectService.shared
    private var soundPreview: NSSound?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var seekGeneration = 0
    private var playWhenSeekFinishes = false
    private var rebuilding = false
    private var restorationTask: Task<Void, Never>?
    private var visualCommitTask: Task<Void, Never>?
    private var snapGuideClearTask: Task<Void, Never>?
    private var transientCache: [UUID: (peakCount: Int, times: [Double])] = [:]

    init() {
        isTimelineSnappingEnabled = UserDefaults.standard.object(forKey: "timelineSnappingEnabled") as? Bool ?? true
        player.automaticallyWaitsToMinimizeStalling = false
        installObservers()
        restorationTask = Task { [weak self] in
            await self?.restoreProject()
        }
    }

    var duration: Double { project.duration }

    var selectedClip: TimelineClip? {
        guard let selectedClipID else { return nil }
        return project.clips.first { $0.id == selectedClipID }
    }

    var selectedTextLayer: ProjectTextLayer? {
        guard let selectedTextLayerID else { return nil }
        return project.textLayers?.first { $0.id == selectedTextLayerID }
    }

    var selectedAudioLayer: ProjectAudioLayer? {
        guard let selectedAudioLayerID else { return nil }
        return project.audioLayers?.first { $0.id == selectedAudioLayerID }
    }

    var hasTimelineSelection: Bool { !timelineSelection.isEmpty }

    func isTimelineSelected(_ item: TimelineSelectionItem) -> Bool {
        timelineSelection.contains(item)
    }

    func selectTimelineItem(
        _ item: TimelineSelectionItem,
        additive: Bool = false,
        toggling: Bool = false
    ) {
        if toggling {
            if timelineSelection.contains(item) {
                timelineSelection.remove(item)
            } else {
                timelineSelection.insert(item)
            }
        } else if additive {
            timelineSelection.insert(item)
        } else {
            timelineSelection = [item]
        }
        syncInspectorSelection(preferred: timelineSelection.contains(item) ? item : nil)
    }

    func setTimelineSelection(_ selection: Set<TimelineSelectionItem>) {
        timelineSelection = selection
        if let preferred = selection.sorted(by: timelineSelectionOrder).last {
            syncInspectorSelection(preferred: preferred)
        } else {
            syncInspectorSelection(preferred: nil)
        }
    }

    func ensureTimelineItemSelected(_ item: TimelineSelectionItem) {
        if !timelineSelection.contains(item) { selectTimelineItem(item) }
    }

    func timelineSelectionBounds() -> (start: Double, end: Double)? {
        let spans = timelineSelection.compactMap(timelineSpan(for:))
        guard let start = spans.map(\.start).min(), let end = spans.map(\.end).max() else {
            return nil
        }
        return (start, end)
    }

    func previewTimelineSelectionMove(delta: Double) {
        guard let bounds = timelineSelectionBounds() else {
            timelineSelectionDragDelta = 0
            return
        }
        timelineSelectionDragDelta = min(
            duration - bounds.end,
            max(-bounds.start, delta)
        )
    }

    func cancelTimelineSelectionMove() {
        timelineSelectionDragDelta = 0
    }

    func commitTimelineSelectionMove() async {
        let delta = timelineSelectionDragDelta
        timelineSelectionDragDelta = 0
        guard abs(delta) > 0.000_001, !timelineSelection.isEmpty else { return }

        let selectedClipIDs = Set(timelineSelection.compactMap { item -> UUID? in
            if case let .clip(id) = item { return id }
            return nil
        })
        if !selectedClipIDs.isEmpty {
            let block = project.clips.filter { selectedClipIDs.contains($0.id) }
            if !block.isEmpty {
                let firstStart = block.compactMap { project.timelineStart(for: $0.id) }.min() ?? 0
                let blockDuration = block.reduce(0) { $0 + $1.duration }
                let remaining = project.clips.filter { !selectedClipIDs.contains($0.id) }
                let target = min(
                    max(0, project.duration - blockDuration),
                    max(0, firstStart + delta)
                )
                var cursor = 0.0
                var insertionIndex = remaining.count
                for (index, clip) in remaining.enumerated() {
                    if target < cursor + clip.duration / 2 {
                        insertionIndex = index
                        break
                    }
                    cursor += clip.duration
                }
                var reordered = remaining
                reordered.insert(contentsOf: block, at: insertionIndex)
                project.clips = reordered
            }
        }

        if var layers = project.textLayers {
            for index in layers.indices where timelineSelection.contains(.text(layers[index].id)) {
                layers[index].timelineStart = min(
                    max(0, duration - layers[index].duration),
                    max(0, layers[index].timelineStart + delta)
                )
            }
            project.textLayers = layers
        }
        if var overlays = project.overlays {
            for index in overlays.indices where timelineSelection.contains(.overlay(overlays[index].id)) {
                overlays[index].timelineStart = min(
                    max(0, duration - overlays[index].duration),
                    max(0, overlays[index].timelineStart + delta)
                )
            }
            project.overlays = overlays
        }
        if var layers = project.audioLayers {
            for index in layers.indices where timelineSelection.contains(.audio(layers[index].id)) {
                layers[index].timelineStart = min(
                    max(0, duration - layers[index].duration),
                    max(0, layers[index].timelineStart + delta)
                )
            }
            project.audioLayers = layers
        }
        await commitTimelineEdit()
    }

    private func timelineSpan(for item: TimelineSelectionItem) -> (start: Double, end: Double)? {
        switch item {
        case let .clip(id):
            guard let clip = project.clips.first(where: { $0.id == id }),
                  let start = project.timelineStart(for: id) else { return nil }
            return (start, start + clip.duration)
        case let .text(id):
            guard let layer = project.textLayers?.first(where: { $0.id == id }) else { return nil }
            return (layer.timelineStart, layer.timelineStart + layer.duration)
        case let .overlay(id):
            guard let overlay = project.overlays?.first(where: { $0.id == id }) else { return nil }
            return (overlay.timelineStart, overlay.timelineStart + overlay.duration)
        case let .audio(id):
            guard let layer = project.audioLayers?.first(where: { $0.id == id }) else { return nil }
            return (layer.timelineStart, layer.timelineStart + layer.duration)
        }
    }

    private func timelineSelectionOrder(_ lhs: TimelineSelectionItem, _ rhs: TimelineSelectionItem) -> Bool {
        (timelineSpan(for: lhs)?.start ?? 0) < (timelineSpan(for: rhs)?.start ?? 0)
    }

    private func applyInspectorSelection(_ item: TimelineSelectionItem) {
        switch item {
        case let .clip(id):
            selectedClipID = id
        case let .text(id):
            selectedTextLayerID = id
            inspectorRequest = EditorInspectorRequest(tool: "Text")
        case let .overlay(id):
            selectedOverlayID = id
        case let .audio(id):
            selectedAudioLayerID = id
            inspectorRequest = EditorInspectorRequest(tool: "Audio")
        }
    }

    private func syncInspectorSelection(preferred item: TimelineSelectionItem?) {
        selectedClipID = nil
        selectedTextLayerID = nil
        selectedAudioLayerID = nil
        selectedOverlayID = nil
        if let item { applyInspectorSelection(item) }
    }

    func toggleTimelineSnapping() {
        isTimelineSnappingEnabled.toggle()
        if !isTimelineSnappingEnabled { setActiveTimelineSnap(nil) }
    }

    func setActiveTimelineSnap(_ match: TimelineSnapMatch?) {
        snapGuideClearTask?.cancel()
        let targetChanged = activeTimelineSnap?.time != match?.time
            || activeTimelineSnap?.kind != match?.kind
        if activeTimelineSnap != match {
            if targetChanged, match != nil {
                NSHapticFeedbackManager.defaultPerformer.perform(
                    .alignment,
                    performanceTime: .now
                )
            }
            activeTimelineSnap = match
        }
        guard match != nil else { return }
        snapGuideClearTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            self?.activeTimelineSnap = nil
        }
    }

    func timelineSnapAnchors() -> [TimelineSnapAnchor] {
        guard duration > 0 else { return [] }
        var anchors: [TimelineSnapAnchor] = [
            TimelineSnapAnchor(time: 0, kind: .boundary),
            TimelineSnapAnchor(time: duration, kind: .boundary),
            TimelineSnapAnchor(time: currentTime, kind: .playhead),
        ]
        var cursor = 0.0
        for clip in project.clips {
            anchors.append(TimelineSnapAnchor(time: cursor, kind: .boundary))
            if let media = project.media(for: clip),
               let peaks = waveformByMedia[media.id], !peaks.isEmpty {
                let sourceTimes: [Double]
                if let cached = transientCache[media.id], cached.peakCount == peaks.count {
                    sourceTimes = cached.times
                } else {
                    sourceTimes = TimelineAudioTransientGeometry.sourceTimes(
                        peaks: peaks,
                        duration: media.duration
                    )
                    transientCache[media.id] = (peaks.count, sourceTimes)
                }
                for sourceTime in sourceTimes where sourceTime >= clip.sourceStart && sourceTime <= clip.sourceEnd {
                    anchors.append(
                        TimelineSnapAnchor(
                            time: cursor + sourceTime - clip.sourceStart,
                            kind: .audio
                        )
                    )
                }
            }
            cursor += clip.duration
            anchors.append(TimelineSnapAnchor(time: cursor, kind: .boundary))
        }
        for layer in project.textLayers ?? [] {
            anchors.append(TimelineSnapAnchor(time: layer.timelineStart, kind: .boundary))
            anchors.append(TimelineSnapAnchor(time: layer.timelineStart + layer.duration, kind: .boundary))
        }
        for overlay in project.overlays ?? [] {
            anchors.append(TimelineSnapAnchor(time: overlay.timelineStart, kind: .boundary))
            anchors.append(TimelineSnapAnchor(time: overlay.timelineStart + overlay.duration, kind: .boundary))
        }
        for layer in project.audioLayers ?? [] {
            anchors.append(TimelineSnapAnchor(time: layer.timelineStart, kind: .audio))
            anchors.append(TimelineSnapAnchor(time: layer.timelineStart + layer.duration, kind: .audio))
        }
        for second in 0 ... Int(ceil(duration)) {
            anchors.append(TimelineSnapAnchor(time: min(duration, Double(second)), kind: .second))
        }
        return anchors
    }

    func importMedia(_ urls: [URL]) async {
        guard !urls.isEmpty else { return }
        await restorationTask?.value
        isBusy = true
        errorMessage = nil
        statusMessage = "Reading media…"
        defer { isBusy = false }

        do {
            for url in urls {
                let canonical = url.resolvingSymlinksInPath()
                let media: ProjectMedia
                if let existing = project.media.first(where: { $0.url == canonical }) {
                    media = existing
                } else {
                    media = try await MediaProbe.inspect(url: canonical)
                    project.media.append(media)
                    beginDerivedMedia(for: media)
                }
                if !media.isImage {
                    project.clips.append(
                        TimelineClip(
                            mediaID: media.id,
                            sourceStart: 0,
                            sourceEnd: media.duration
                        )
                    )
                }
                if project.name == "Untitled project" {
                    project.name = canonical.deletingPathExtension().lastPathComponent
                }
                selectedClipID = project.clips.last?.id
            }
            project.updatedAt = Date()
            try await rebuildComposition(preserveTime: false)
            await persist()
            statusMessage = "Ready"
        } catch {
            show(error)
        }
    }

    func togglePlayback() {
        if player.rate != 0 || isPlaying {
            player.pause()
            isPlaying = false
            playWhenSeekFinishes = false
            return
        }
        guard player.currentItem != nil, duration > 0 else { return }
        if currentTime >= duration - 0.02 {
            seek(to: 0, exact: true, playAfter: true)
            return
        }
        if player.currentItem?.status == .readyToPlay {
            player.playImmediately(atRate: 1)
            isPlaying = true
        } else {
            playWhenSeekFinishes = true
            seek(to: currentTime, exact: false, playAfter: true)
        }
    }

    func pausePlayback() {
        player.pause()
        isPlaying = false
        playWhenSeekFinishes = false
    }

    func scrub(to time: Double) {
        seek(to: time, exact: false, playAfter: false)
    }

    func finishScrubbing(at time: Double) {
        seek(to: time, exact: true, playAfter: false)
    }

    func seekToTranscriptWord(_ word: TranscriptWord) {
        pausePlayback()
        seek(to: project.nearestTimelineTime(for: word), exact: true, playAfter: false)
    }

    func deleteTranscriptWord(_ word: TranscriptWord) async {
        await deleteTranscriptWords([word])
    }

    func deleteTranscriptWords(_ words: [TranscriptWord]) async {
        let keptIDs = Set(words.filter { project.isWordKept($0) }.map(\.id))
        guard !keptIDs.isEmpty else { return }
        let ranges = TranscriptWordSelection.sourceRanges(
            for: keptIDs,
            in: project.transcript ?? []
        )
        for mediaID in Set(ranges.map(\.mediaID)) {
            let duration = project.media.first(where: { $0.id == mediaID })?.duration ?? .greatestFiniteMagnitude
            project.removeSourceRanges(
                ranges
                    .filter { $0.mediaID == mediaID }
                    .map { ($0.start, min(duration, $0.end)) },
                for: mediaID
            )
        }
        selectedClipID = project.clip(at: min(currentTime, project.duration))
            .map { project.clips[$0.index].id }
        currentTime = min(currentTime, project.duration)
        await commitTimelineEdit()
    }

    func restoreTranscriptWord(_ word: TranscriptWord) async {
        await restoreTranscriptWords([word])
    }

    func restoreTranscriptWords(_ words: [TranscriptWord]) async {
        let deletedWords = words.filter { !project.isWordKept($0) }
        let deletedIDs = Set(deletedWords.map(\.id))
        guard let firstWord = deletedWords.first, !deletedIDs.isEmpty else { return }
        let ranges = TranscriptWordSelection.sourceRanges(
            for: deletedIDs,
            in: project.transcript ?? []
        )
        for range in ranges {
            let duration = project.media.first(where: { $0.id == range.mediaID })?.duration ?? .greatestFiniteMagnitude
            project.restoreSourceRange(
                (range.start, min(duration, range.end)),
                for: range.mediaID
            )
        }
        currentTime = project.nearestTimelineTime(for: firstWord)
        selectedClipID = project.clip(at: currentTime).map { project.clips[$0.index].id }
        await commitTimelineEdit()
        seek(to: currentTime, exact: true, playAfter: false)
    }

    func deleteTranscriptPause(mediaID: UUID, start: Double, end: Double) async {
        guard end - start >= 0.02,
              project.isSourceRangeKept(mediaID: mediaID, start: start, end: end)
        else { return }
        project.removeSourceRanges([(start, end)], for: mediaID)
        currentTime = min(currentTime, project.duration)
        selectedClipID = project.clip(at: currentTime).map { project.clips[$0.index].id }
        await commitTimelineEdit()
    }

    func restoreTranscriptPause(mediaID: UUID, start: Double, end: Double) async {
        guard end - start >= 0.02,
              !project.isSourceRangeKept(mediaID: mediaID, start: start, end: end)
        else { return }
        project.restoreSourceRange((start, end), for: mediaID)
        let marker = TranscriptWord(mediaID: mediaID, text: "", start: start, end: end)
        currentTime = project.nearestTimelineTime(for: marker)
        selectedClipID = project.clip(at: currentTime).map { project.clips[$0.index].id }
        await commitTimelineEdit()
        seek(to: currentTime, exact: true, playAfter: false)
    }

    func splitAtPlayhead() async {
        let selection = commandTimelineSelection()
        var didSplit = false
        var resultingSelection: Set<TimelineSelectionItem> = []

        for item in selection {
            switch item {
            case let .clip(id):
                if project.split(clipID: id, atTimelineTime: currentTime) {
                    didSplit = true
                    if let hit = project.clip(at: min(project.duration, currentTime + 0.000_1)) {
                        resultingSelection.insert(.clip(project.clips[hit.index].id))
                    }
                }
            case let .text(id):
                guard let index = project.textLayers?.firstIndex(where: { $0.id == id }),
                      let layer = project.textLayers?[index],
                      currentTime > layer.timelineStart + 0.02,
                      currentTime < layer.timelineStart + layer.duration - 0.02 else { continue }
                var left = layer
                left.duration = currentTime - layer.timelineStart
                let right = ProjectTextLayer(
                    text: layer.text,
                    timelineStart: currentTime,
                    duration: layer.duration - left.duration,
                    x: layer.x,
                    y: layer.y,
                    width: layer.width,
                    fontScale: layer.fontScale,
                    style: layer.style,
                    font: layer.font
                )
                project.textLayers?.replaceSubrange(index ... index, with: [left, right])
                resultingSelection.insert(.text(right.id))
                didSplit = true
            case let .overlay(id):
                guard let index = project.overlays?.firstIndex(where: { $0.id == id }),
                      let overlay = project.overlays?[index],
                      currentTime > overlay.timelineStart + 0.02,
                      currentTime < overlay.timelineStart + overlay.duration - 0.02 else { continue }
                let elapsed = currentTime - overlay.timelineStart
                var left = overlay
                left.duration = elapsed
                let right = ProjectOverlay(
                    mediaID: overlay.mediaID,
                    timelineStart: currentTime,
                    duration: overlay.duration - elapsed,
                    sourceStart: overlay.sourceStart + elapsed,
                    x: overlay.x,
                    y: overlay.y,
                    width: overlay.width,
                    height: overlay.height
                )
                project.overlays?.replaceSubrange(index ... index, with: [left, right])
                resultingSelection.insert(.overlay(right.id))
                didSplit = true
            case let .audio(id):
                guard let index = project.audioLayers?.firstIndex(where: { $0.id == id }),
                      let layer = project.audioLayers?[index],
                      currentTime > layer.timelineStart + 0.02,
                      currentTime < layer.timelineStart + layer.duration - 0.02 else { continue }
                let elapsed = currentTime - layer.timelineStart
                var left = layer
                left.duration = elapsed
                let right = ProjectAudioLayer(
                    url: layer.url,
                    name: layer.name,
                    timelineStart: currentTime,
                    duration: layer.duration - elapsed,
                    sourceStart: layer.sourceStart + elapsed,
                    sourceDuration: layer.sourceDuration,
                    volume: layer.volume,
                    builtInID: layer.builtInID
                )
                project.audioLayers?.replaceSubrange(index ... index, with: [left, right])
                resultingSelection.insert(.audio(right.id))
                didSplit = true
            }
        }
        guard didSplit else { return }
        setTimelineSelection(resultingSelection)
        await commitTimelineEdit()
    }

    func deleteSelected() async {
        await deleteTimelineSelection()
    }

    func deleteTimelineSelection() async {
        let selection = commandTimelineSelection()
        guard !selection.isEmpty else { return }
        let clipIDs = Set(selection.compactMap { if case let .clip(id) = $0 { id } else { nil } })
        let textIDs = Set(selection.compactMap { if case let .text(id) = $0 { id } else { nil } })
        let overlayIDs = Set(selection.compactMap { if case let .overlay(id) = $0 { id } else { nil } })
        let audioIDs = Set(selection.compactMap { if case let .audio(id) = $0 { id } else { nil } })
        project.clips.removeAll { clipIDs.contains($0.id) }
        project.textLayers?.removeAll { textIDs.contains($0.id) }
        project.overlays?.removeAll { overlayIDs.contains($0.id) }
        project.audioLayers?.removeAll { audioIDs.contains($0.id) }
        setTimelineSelection([])
        currentTime = min(currentTime, project.duration)
        await commitTimelineEdit()
    }

    func trimTimelineSelection(toPlayhead edge: TimelineEditEdge) async {
        let selection = commandTimelineSelection()
        guard !selection.isEmpty else { return }
        let originalClipStarts = Dictionary(uniqueKeysWithValues: project.clips.compactMap { clip in
            project.timelineStart(for: clip.id).map { (clip.id, $0) }
        })
        var changed = false
        var leadingClipBoundary: Double?

        for item in selection {
            switch item {
            case let .clip(id):
                guard let index = project.clips.firstIndex(where: { $0.id == id }),
                      let start = originalClipStarts[id] else { continue }
                var clip = project.clips[index]
                let elapsed = currentTime - start
                guard elapsed > 1.0 / 30.0, elapsed < clip.duration - 1.0 / 30.0 else { continue }
                let sourceTime = clip.sourceStart + elapsed
                if edge == .leading {
                    clip.sourceStart = sourceTime
                    leadingClipBoundary = min(leadingClipBoundary ?? start, start)
                } else {
                    clip.sourceEnd = sourceTime
                }
                project.clips[index] = clip
                changed = true
            case let .text(id):
                guard let index = project.textLayers?.firstIndex(where: { $0.id == id }),
                      var layer = project.textLayers?[index],
                      currentTime > layer.timelineStart + 0.02,
                      currentTime < layer.timelineStart + layer.duration - 0.02 else { continue }
                let end = layer.timelineStart + layer.duration
                if edge == .leading {
                    layer.timelineStart = currentTime
                    layer.duration = end - currentTime
                } else {
                    layer.duration = currentTime - layer.timelineStart
                }
                project.textLayers?[index] = layer
                changed = true
            case let .overlay(id):
                guard let index = project.overlays?.firstIndex(where: { $0.id == id }),
                      var overlay = project.overlays?[index],
                      currentTime > overlay.timelineStart + 0.02,
                      currentTime < overlay.timelineStart + overlay.duration - 0.02 else { continue }
                let end = overlay.timelineStart + overlay.duration
                if edge == .leading {
                    let elapsed = currentTime - overlay.timelineStart
                    overlay.timelineStart = currentTime
                    overlay.sourceStart += elapsed
                    overlay.duration = end - currentTime
                } else {
                    overlay.duration = currentTime - overlay.timelineStart
                }
                project.overlays?[index] = overlay
                changed = true
            case let .audio(id):
                guard let index = project.audioLayers?.firstIndex(where: { $0.id == id }),
                      var layer = project.audioLayers?[index],
                      currentTime > layer.timelineStart + 0.02,
                      currentTime < layer.timelineStart + layer.duration - 0.02 else { continue }
                let end = layer.timelineStart + layer.duration
                if edge == .leading {
                    let elapsed = currentTime - layer.timelineStart
                    layer.timelineStart = currentTime
                    layer.sourceStart += elapsed
                    layer.duration = end - currentTime
                } else {
                    layer.duration = currentTime - layer.timelineStart
                }
                project.audioLayers?[index] = layer
                changed = true
            }
        }
        guard changed else { return }
        if edge == .leading, let leadingClipBoundary { currentTime = leadingClipBoundary }
        currentTime = min(currentTime, project.duration)
        await commitTimelineEdit()
    }

    private func commandTimelineSelection() -> Set<TimelineSelectionItem> {
        if !timelineSelection.isEmpty { return timelineSelection }
        if let hit = project.clip(at: currentTime) {
            return [.clip(project.clips[hit.index].id)]
        }
        if let selectedClipID { return [.clip(selectedClipID)] }
        return []
    }

    func export(to url: URL) async {
        guard !project.clips.isEmpty else { return }
        isExporting = true
        errorMessage = nil
        statusMessage = "Exporting native composition…"
        defer { isExporting = false }
        do {
            try await ExportService.export(project: project, to: url)
            statusMessage = "Exported \(url.lastPathComponent) with audio verified"
            NSWorkspace.shared.activateFileViewerSelecting([url])
        } catch {
            show(error)
        }
    }

    func select(_ clipID: UUID) {
        selectTimelineItem(.clip(clipID))
    }

    func commitClipTrim(_ updated: TimelineClip) async {
        guard let index = project.clips.firstIndex(where: { $0.id == updated.id }) else { return }
        project.clips[index] = updated
        selectedClipID = updated.id
        timelineSelection = [.clip(updated.id)]
        currentTime = min(currentTime, project.duration)
        await commitTimelineEdit()
    }

    func appendMediaToTimeline(_ mediaID: UUID) async {
        guard let media = project.media.first(where: { $0.id == mediaID }), !media.isImage else { return }
        project.clips.append(
            TimelineClip(
                mediaID: media.id,
                sourceStart: 0,
                sourceEnd: media.duration
            )
        )
        selectedClipID = project.clips.last?.id
        await commitTimelineEdit()
    }

    func addOverlay(_ mediaID: UUID) async {
        guard
            duration > 0,
            let media = project.media.first(where: { $0.id == mediaID })
        else { return }
        let start = min(currentTime, max(0, duration - 0.1))
        let available = max(0.1, duration - start)
        let overlayDuration = min(available, media.isImage ? 4 : media.duration)
        var overlays = project.overlays ?? []
        overlays.append(
            ProjectOverlay(
                mediaID: mediaID,
                timelineStart: start,
                duration: overlayDuration
            )
        )
        project.overlays = overlays
        await commitTimelineEdit()
    }

    func addTextLayer(asHook: Bool = false) {
        guard duration > 0 else { return }
        let start = min(currentTime, max(0, duration - 0.1))
        let available = max(0.1, duration - start)
        let layer = ProjectTextLayer(
            text: asHook ? "Your hook" : "Text",
            timelineStart: start,
            duration: min(asHook ? 4 : 5, available),
            y: asHook ? 0.14 : 0.5,
            width: asHook ? 0.74 : 0.7,
            fontScale: asHook ? 0.043 : 0.05,
            style: asHook ? .whiteCard : .plain,
            font: asHook ? .rounded : .modern
        )
        var layers = project.textLayers ?? []
        layers.append(layer)
        project.textLayers = layers
        selectedTextLayerID = layer.id
        timelineSelection = [.text(layer.id)]
        inspectorRequest = EditorInspectorRequest(tool: "Text")
        project.updatedAt = Date()
        scheduleVisualCommit()
    }

    func previewSoundEffect(_ effect: SoundEffectDescriptor) async {
        do {
            let url = try await soundEffectService.fileURL(for: effect)
            soundPreview?.stop()
            soundPreview = NSSound(contentsOf: url, byReference: true)
            soundPreview?.play()
        } catch {
            show(error)
        }
    }

    func addSoundEffect(_ effect: SoundEffectDescriptor) async {
        guard duration > 0 else { return }
        do {
            let url = try await soundEffectService.fileURL(for: effect)
            let start = min(currentTime, max(0, duration - 0.02))
            let layer = ProjectAudioLayer(
                url: url,
                name: effect.name,
                timelineStart: start,
                duration: min(effect.duration, max(0.02, duration - start)),
                sourceDuration: effect.duration,
                builtInID: effect.id
            )
            var layers = project.audioLayers ?? []
            layers.append(layer)
            project.audioLayers = layers
            selectedAudioLayerID = layer.id
            timelineSelection = [.audio(layer.id)]
            inspectorRequest = EditorInspectorRequest(tool: "Audio")
            await commitTimelineEdit()
        } catch {
            show(error)
        }
    }

    func importAudio(_ urls: [URL]) async {
        guard duration > 0, !urls.isEmpty else { return }
        do {
            var insertionTime = min(currentTime, max(0, duration - 0.02))
            var layers = project.audioLayers ?? []
            for rawURL in urls {
                let url = rawURL.resolvingSymlinksInPath()
                let sourceDuration = try await soundEffectService.duration(of: url)
                let layerDuration = min(sourceDuration, max(0.02, duration - insertionTime))
                guard layerDuration > 0 else { continue }
                let layer = ProjectAudioLayer(
                    url: url,
                    name: url.deletingPathExtension().lastPathComponent,
                    timelineStart: insertionTime,
                    duration: layerDuration,
                    sourceDuration: sourceDuration
                )
                layers.append(layer)
                selectedAudioLayerID = layer.id
                insertionTime = min(duration, insertionTime + layerDuration)
            }
            project.audioLayers = layers
            inspectorRequest = EditorInspectorRequest(tool: "Audio")
            await commitTimelineEdit()
        } catch {
            show(error)
        }
    }

    func selectAudioLayer(_ id: UUID) {
        selectTimelineItem(.audio(id))
    }

    func updateAudioLayer(_ updated: ProjectAudioLayer) async {
        guard let index = project.audioLayers?.firstIndex(where: { $0.id == updated.id }) else { return }
        project.audioLayers?[index] = updated
        await commitTimelineEdit()
    }

    func deleteSelectedAudioLayer() async {
        guard let selectedAudioLayerID else { return }
        project.audioLayers?.removeAll { $0.id == selectedAudioLayerID }
        self.selectedAudioLayerID = project.audioLayers?.last?.id
        await commitTimelineEdit()
    }

    func selectOverlay(_ id: UUID) {
        selectTimelineItem(.overlay(id))
    }

    func commitOverlayTrim(_ updated: ProjectOverlay) {
        guard let index = project.overlays?.firstIndex(where: { $0.id == updated.id }) else { return }
        project.overlays?[index] = updated
        selectedOverlayID = updated.id
        project.updatedAt = Date()
        scheduleVisualCommit()
    }

    func commitAudioTrim(_ updated: ProjectAudioLayer) async {
        guard let index = project.audioLayers?.firstIndex(where: { $0.id == updated.id }) else { return }
        project.audioLayers?[index] = updated
        selectedAudioLayerID = updated.id
        await commitTimelineEdit()
    }

    func selectTextLayer(_ id: UUID) {
        selectTimelineItem(.text(id))
    }

    func updateTextLayer(_ updated: ProjectTextLayer) {
        guard let index = project.textLayers?.firstIndex(where: { $0.id == updated.id }) else { return }
        project.textLayers?[index] = updated
        project.updatedAt = Date()
        scheduleVisualCommit()
    }

    func deleteSelectedTextLayer() {
        guard let selectedTextLayerID else { return }
        project.textLayers?.removeAll { $0.id == selectedTextLayerID }
        self.selectedTextLayerID = project.textLayers?.last?.id
        project.updatedAt = Date()
        scheduleVisualCommit()
    }

    func resetTimelineToSource() async {
        guard let media = project.media.first(where: { !$0.isImage }) else { return }
        project.clips = [
            TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: media.duration),
        ]
        project.overlays = []
        project.textLayers = []
        project.audioLayers = []
        selectedClipID = project.clips.first?.id
        selectedTextLayerID = nil
        selectedAudioLayerID = nil
        selectedOverlayID = nil
        timelineSelection = selectedClipID.map { [.clip($0)] } ?? []
        currentTime = 0
        await commitTimelineEdit()
    }

    func transcribeProject() async {
        guard !project.clips.isEmpty, !isAIEditing else { return }
        isAIEditing = true
        isBusy = true
        aiProgress = 0
        errorMessage = nil
        defer {
            isAIEditing = false
            isBusy = false
        }
        do {
            let mediaIDs = Array(Set(project.clips.map(\.mediaID)))
            for (index, mediaID) in mediaIDs.enumerated() {
                guard let media = project.media.first(where: { $0.id == mediaID }) else { continue }
                statusMessage = "Transcribing \(media.name)…"
                let words = try await aiEditService.transcribe(media: media)
                var transcript = project.transcript ?? []
                transcript.removeAll { $0.mediaID == mediaID }
                transcript.append(contentsOf: words)
                project.transcript = transcript
                aiProgress = Double(index + 1) / Double(max(1, mediaIDs.count))
            }
            project.updatedAt = Date()
            await persist()
            statusMessage = "Transcript ready · \(project.transcript?.count ?? 0) words"
        } catch {
            show(error)
        }
    }

    func runOneClickEdit() async {
        guard !project.clips.isEmpty, !isAIEditing else { return }
        let original = project
        isAIEditing = true
        isBusy = true
        aiProgress = 0
        errorMessage = nil
        defer {
            isAIEditing = false
            isBusy = false
        }

        do {
            let mediaIDs = Array(Set(project.clips.map(\.mediaID)))
            for (index, mediaID) in mediaIDs.enumerated() {
                guard let media = project.media.first(where: { $0.id == mediaID }) else { continue }
                var words = (project.transcript ?? []).filter { $0.mediaID == mediaID }
                if words.isEmpty {
                    statusMessage = "Transcribing \(media.name)…"
                    words = try await aiEditService.transcribe(media: media)
                    var transcript = project.transcript ?? []
                    transcript.removeAll { $0.mediaID == mediaID }
                    transcript.append(contentsOf: words)
                    project.transcript = transcript
                }
                guard !words.isEmpty else {
                    throw NativeEditorError.aiFailed("No spoken words were found in \(media.name).")
                }

                aiProgress = (Double(index) + 0.45) / Double(max(1, mediaIDs.count))
                statusMessage = "Choosing the clean final takes…"
                let cuts = try await aiEditService.cleanCuts(words: words)
                statusMessage = "Removing retakes and dead pauses…"
                let ranges = await aiEditService.autoEditRanges(
                    words: words,
                    duration: media.duration,
                    aiCuts: cuts
                )
                project.removeSourceRanges(ranges, for: mediaID)
                aiProgress = Double(index + 1) / Double(max(1, mediaIDs.count))
            }
            guard !project.clips.isEmpty else {
                project = original
                throw NativeEditorError.aiFailed("The proposed edit was empty, so the original was restored.")
            }
            selectedClipID = project.clips.first?.id
            currentTime = 0
            try await rebuildComposition(preserveTime: false)
            await persist()
            statusMessage = "1-Click Edit complete · \(project.clips.count) clips"
        } catch {
            project = original
            show(error)
        }
    }

    func autoTrimSilences() async {
        guard !project.clips.isEmpty, !isAIEditing else { return }
        let original = project
        isAIEditing = true
        isBusy = true
        aiProgress = 0
        errorMessage = nil
        defer {
            isAIEditing = false
            isBusy = false
        }
        do {
            let mediaIDs = Array(Set(project.clips.map(\.mediaID)))
            for (index, mediaID) in mediaIDs.enumerated() {
                guard let media = project.media.first(where: { $0.id == mediaID }) else { continue }
                var words = (project.transcript ?? []).filter { $0.mediaID == mediaID }
                if words.isEmpty {
                    statusMessage = "Transcribing before auto-trim…"
                    words = try await aiEditService.transcribe(media: media)
                    var transcript = project.transcript ?? []
                    transcript.removeAll { $0.mediaID == mediaID }
                    transcript.append(contentsOf: words)
                    project.transcript = transcript
                }
                guard !words.isEmpty else { continue }
                statusMessage = "Trimming silent gaps…"
                let ranges = await aiEditService.silenceRanges(
                    words: words,
                    duration: media.duration
                )
                project.removeSourceRanges(ranges, for: mediaID)
                aiProgress = Double(index + 1) / Double(max(1, mediaIDs.count))
            }
            guard !project.clips.isEmpty else {
                project = original
                throw NativeEditorError.aiFailed("Auto-trim found no usable video, so the original was restored.")
            }
            selectedClipID = project.clips.first?.id
            timelineSelection = selectedClipID.map { [.clip($0)] } ?? []
            currentTime = 0
            try await rebuildComposition(preserveTime: false)
            await persist()
            statusMessage = "Auto-trim complete · \(project.clips.count) clips"
        } catch {
            project = original
            show(error)
        }
    }

    func dismissError() {
        errorMessage = nil
    }

    private func commitTimelineEdit() async {
        project.updatedAt = Date()
        do {
            try await rebuildComposition(preserveTime: true)
            await persist()
            statusMessage = "Ready"
        } catch {
            show(error)
        }
    }

    private func scheduleVisualCommit() {
        visualCommitTask?.cancel()
        visualCommitTask = Task { [weak self] in
            do {
                try await Task.sleep(for: .milliseconds(140))
                guard !Task.isCancelled, let self else { return }
                // Text is rendered directly over the native player. Persisting
                // must never swap the player item or interrupt active playback.
                await self.persist()
                self.statusMessage = "Ready"
            } catch is CancellationError {
                return
            } catch {
                self?.show(error)
            }
        }
    }

    private func rebuildComposition(preserveTime: Bool) async throws {
        guard !project.clips.isEmpty else {
            player.replaceCurrentItem(with: nil)
            currentTime = 0
            isPlaying = false
            return
        }
        while rebuilding {
            try await Task.sleep(for: .milliseconds(10))
        }
        rebuilding = true
        defer { rebuilding = false }

        let resumeAt = preserveTime ? min(currentTime, project.duration) : 0
        let resumePlayback = isPlaying || player.rate != 0
        let built = try await CompositionBuilder.build(project: project)
        let item = built.playerItem
        _ = try await item.asset.load(.isPlayable)
        player.pause()
        player.replaceCurrentItem(with: item)
        seek(to: resumeAt, exact: true, playAfter: resumePlayback)
    }

    private func seek(to requestedTime: Double, exact: Bool, playAfter: Bool) {
        guard player.currentItem != nil else { return }
        let targetSeconds = min(max(0, requestedTime), duration)
        currentTime = targetSeconds
        seekGeneration += 1
        let generation = seekGeneration
        playWhenSeekFinishes = playAfter
        let tolerance = exact ? CMTime.zero : CMTime(seconds: 0.04, preferredTimescale: 600)
        player.seek(
            to: CMTime(seconds: targetSeconds, preferredTimescale: 600),
            toleranceBefore: tolerance,
            toleranceAfter: tolerance
        ) { [weak self] finished in
            Task { @MainActor in
                guard
                    let self,
                    finished,
                    generation == self.seekGeneration
                else { return }
                if self.playWhenSeekFinishes {
                    self.player.playImmediately(atRate: 1)
                    self.isPlaying = true
                    self.playWhenSeekFinishes = false
                }
            }
        }
    }

    private func installObservers() {
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(value: 1, timescale: 30),
            queue: .main
        ) { [weak self] time in
            MainActor.assumeIsolated {
                guard let self, self.player.rate != 0 else { return }
                self.currentTime = min(max(0, time.seconds), self.duration)
                self.isPlaying = true
            }
        }
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.isPlaying = false
            }
        }
    }

    private func beginDerivedMedia(for media: ProjectMedia) {
        if media.isImage {
            if let image = NSImage(contentsOf: media.url),
               let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
            {
                thumbnailsByMedia[media.id] = [cgImage]
            }
            waveformByMedia[media.id] = []
            waveformProgressByMedia[media.id] = 1
            return
        }
        Task {
            do {
                _ = try await thumbnailService.thumbnails(for: media) { [weak self] images in
                    self?.thumbnailsByMedia[media.id] = images
                }
            } catch {
                // The editor is usable without a thumbnail.
            }
        }
        Task {
            do {
                _ = try await waveformService.peaks(for: media) { [weak self] peaks, fraction in
                    self?.waveformByMedia[media.id] = peaks
                    self?.waveformProgressByMedia[media.id] = fraction
                }
            } catch {
                waveformProgressByMedia[media.id] = 1
            }
        }
    }

    private func restoreProject() async {
        do {
            guard let saved = try await store.load() else { return }
            let availableMedia = saved.media.filter {
                FileManager.default.fileExists(atPath: $0.url.path)
            }
            let availableIDs = Set(availableMedia.map(\.id))
            project = EditorProject(
                id: saved.id,
                name: saved.name,
                createdAt: saved.createdAt,
                updatedAt: saved.updatedAt,
                media: availableMedia,
                clips: saved.clips.filter { availableIDs.contains($0.mediaID) },
                transcript: saved.transcript?.filter { availableIDs.contains($0.mediaID) },
                overlays: saved.overlays?.filter { availableIDs.contains($0.mediaID) },
                textLayers: saved.textLayers,
                audioLayers: saved.audioLayers?.filter {
                    FileManager.default.fileExists(atPath: $0.url.path)
                }
            )
            selectedClipID = project.clips.first?.id
            selectedTextLayerID = project.textLayers?.first?.id
            selectedAudioLayerID = project.audioLayers?.first?.id
            selectedOverlayID = project.overlays?.first?.id
            timelineSelection = selectedClipID.map { [.clip($0)] } ?? []
            for media in project.media { beginDerivedMedia(for: media) }
            if !project.clips.isEmpty {
                try await rebuildComposition(preserveTime: false)
                statusMessage = "Restored \(project.name)"
            }
        } catch {
            show(error)
        }
    }

    private func persist() async {
        do {
            try await store.save(project)
        } catch {
            show(error)
        }
    }

    private func show(_ error: Error) {
        errorMessage = error.localizedDescription
        statusMessage = "Needs attention"
    }
}
