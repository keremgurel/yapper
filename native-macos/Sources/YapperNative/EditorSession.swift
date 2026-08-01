@preconcurrency import AVFoundation
import AppKit
import Combine
import CoreGraphics
import Foundation

@MainActor
final class EditorSession: ObservableObject {
    @Published private(set) var project = EditorProject()
    @Published var selectedClipID: UUID?
    @Published private(set) var currentTime = 0.0
    @Published private(set) var isPlaying = false
    @Published private(set) var isBusy = false
    @Published private(set) var isExporting = false
    @Published private(set) var statusMessage = "Import video to begin"
    @Published private(set) var errorMessage: String?
    @Published private(set) var waveformByMedia: [UUID: [Float]] = [:]
    @Published private(set) var waveformProgressByMedia: [UUID: Double] = [:]
    @Published private(set) var thumbnailsByMedia: [UUID: [CGImage]] = [:]

    let player = AVPlayer()

    private let store = ProjectStore.shared
    private let waveformService = WaveformService()
    private let thumbnailService = ThumbnailService()
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var seekGeneration = 0
    private var playWhenSeekFinishes = false
    private var rebuilding = false
    private var restorationTask: Task<Void, Never>?

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
                project.clips.append(
                    TimelineClip(
                        mediaID: media.id,
                        sourceStart: 0,
                        sourceEnd: media.duration
                    )
                )
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
        guard let media = project.media.first(where: { $0.id == mediaID }) else { return }
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
                clips: saved.clips.filter { availableIDs.contains($0.mediaID) }
            )
            selectedClipID = project.clips.first?.id
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
