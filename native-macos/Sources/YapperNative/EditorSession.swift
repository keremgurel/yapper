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

    init() {
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

    func splitAtPlayhead() async {
        let clipID: UUID
        if let selectedClipID {
            clipID = selectedClipID
        } else if let hit = project.clip(at: currentTime) {
            clipID = project.clips[hit.index].id
            selectedClipID = clipID
        } else {
            return
        }
        guard project.split(clipID: clipID, atTimelineTime: currentTime) else { return }
        if let hit = project.clip(at: currentTime) {
            selectedClipID = project.clips[hit.index].id
        }
        await commitTimelineEdit()
    }

    func deleteSelected() async {
        guard let selectedClipID, project.delete(clipID: selectedClipID) else { return }
        self.selectedClipID = project.clip(at: min(currentTime, project.duration))
            .map { project.clips[$0.index].id }
        currentTime = min(currentTime, project.duration)
        await commitTimelineEdit()
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
        selectedClipID = clipID
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
                builtInID: effect.id
            )
            var layers = project.audioLayers ?? []
            layers.append(layer)
            project.audioLayers = layers
            selectedAudioLayerID = layer.id
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
                    duration: layerDuration
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
        selectedAudioLayerID = id
        inspectorRequest = EditorInspectorRequest(tool: "Audio")
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

    func selectTextLayer(_ id: UUID) {
        selectedTextLayerID = id
        inspectorRequest = EditorInspectorRequest(tool: "Text")
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
