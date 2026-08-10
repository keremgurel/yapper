@preconcurrency import AVFoundation
import AppKit
import Combine
import CoreGraphics
import Foundation

struct EditorInspectorRequest: Equatable, Sendable {
    let id = UUID()
    let tool: String
}

enum OneClickEditStage: Int, CaseIterable, Sendable {
    case preparing
    case transcribing
    case removingRetakes
    case cuttingPauses
    case trimmingSilence
    case addingCaptions

    var title: String {
        switch self {
        case .preparing: "Preparing your video"
        case .transcribing: "Transcribing your audio"
        case .removingRetakes: "Removing mistakes & retakes"
        case .cuttingPauses: "Cutting pauses"
        case .trimmingSilence: "Trimming silence"
        case .addingCaptions: "Adding captions"
        }
    }
}

@MainActor
final class EditorSession: ObservableObject {
    @Published private(set) var project = EditorProject() {
        didSet { refreshPlaybackCursor() }
    }
    @Published var selectedClipID: UUID?
    /// What is picked in the media bin. Its own selection, not the timeline's:
    /// a file in the bin may be on the timeline several times or not at all.
    @Published var mediaSelection: MediaSelection = .empty
    @Published var selectedTextLayerID: UUID?
    @Published var selectedAudioLayerID: UUID?
    @Published var selectedOverlayID: UUID?
    /// The speaker's own picture, picked up for framing. Its own flag rather
    /// than a clip selection: the timeline keeps a clip selected almost all the
    /// time, and the framing handles must only appear when they were asked for.
    @Published var isVideoFrameSelected = false
    /// What the crop editor is open on, or nil when it is closed. See
    /// `CropRequest`.
    @Published var cropRequest: CropRequest?
    /// Whether Chirpy is grown into the panel or sitting in the corner.
    ///
    /// Held here rather than inside the view so ⌘K and Escape can reach it. A
    /// flag that only the bird can see is a flag only the bird can toggle.
    @Published var isAssistantOpen = false
    @Published private(set) var timelineSelection: Set<TimelineSelectionItem> = []
    /// Live drag values live on `timelineDrag`; these read through to it so the
    /// editing logic below is unchanged. They are private on purpose: a view
    /// reading them here would see the right number and never be told when it
    /// changes, so the compiler points every view at the drag state instead.
    private var timelineSelectionDragDelta: Double { timelineDrag.offset }
    private var timelineReorderPlan: TimelineReorderPlan? { timelineDrag.reorderPlan }
    @Published private(set) var inspectorRequest: EditorInspectorRequest?
    /// The playhead, stored on the clock rather than published here.
    ///
    /// Every published change on this object invalidates every view that
    /// observes it, and the editor observes it everywhere. A playhead moving at
    /// thirty frames a second was therefore rebuilding the transcript, the
    /// workbench and the player on every frame. The clock publishes to the two
    /// small views that draw the time; the editor's own logic keeps reading and
    /// writing `currentTime` exactly as before.
    private(set) var currentTime: Double {
        get { playbackClock.currentTime }
        set {
            playbackClock.set(newValue)
            syncPlaybackCursor()
        }
    }
    @Published private(set) var isPlaying = false
    @Published private(set) var isBusy = false
    @Published private(set) var isExporting = false
    @Published private(set) var isAIEditing = false
    @Published private(set) var canUndo = false
    @Published private(set) var canRedo = false
    @Published private(set) var aiProgress = 0.0
    @Published private(set) var oneClickEditStage: OneClickEditStage?
    @Published private(set) var statusMessage = "Import video to begin"
    @Published private(set) var errorMessage: String?
    @Published private(set) var waveformByMedia: [UUID: [Float]] = [:]
    @Published private(set) var waveformProgressByMedia: [UUID: Double] = [:]
    @Published private(set) var thumbnailsByMedia: [UUID: [CGImage]] = [:]
    @Published var isTimelineSnappingEnabled: Bool {
        didSet { UserDefaults.standard.set(isTimelineSnappingEnabled, forKey: "timelineSnappingEnabled") }
    }
    /// The creator's own spellings, applied to everything transcribed from
    /// here on.
    @Published var dictionaryEntries: [DictionaryEntry] = []
    /// A one-word caption fix worth remembering, waiting on a yes or no.
    @Published var dictionarySuggestion: CaptionCorrection?
    /// Where the AI overlay placement pass has got to.
    @Published private(set) var overlayPlacement: OverlayPlacementStatus = .idle
    /// Caption cards the styling controls act on when Apply-to-all is off.
    @Published private(set) var selectedCaptionIDs: Set<UUID> = []
    /// Whether caption styling changes go to the shared style or the selection.
    @Published var captionApplyToAll = true
    /// The effect being played to be heard, if any. Published so the card that
    /// started it can offer a stop.
    @Published private(set) var previewingSoundID: String?

    let player = AVPlayer()
    /// Where the playhead is, published on its own so the moving time only
    /// redraws the playhead and the transport readout.
    let playbackClock = PlaybackClock()
    /// What the playhead is over, published only when the answer changes.
    let playbackCursor = PlaybackCursor()
    /// Live drag feedback, published on its own for the same reason as the
    /// clock: a drag updates on every mouse move, and only the timeline tracks
    /// have any use for it.
    let timelineDrag = TimelineDragState()
    /// The caption cue list, rebuilt only when the captions themselves change.
    let captionCueCache = CaptionCueCache()
    /// A drag in progress on the player canvas, held outside the views so
    /// rebuilding them cannot lose it.
    let canvasDrag = CanvasDragState()
    /// What framing the composition on screen is actually rendering, so the
    /// canvas can carry the picture the rest of the way while a rebuild runs.
    let renderedFraming = RenderedFramingStore()
    /// Whether the project's files are still reachable. Published on its own so
    /// a card being pulled redraws the banner and nothing else.
    let mediaAvailability = MediaAvailabilityWatcher()
    /// The fader being dragged right now, held outside the project so a drag
    /// does not republish the whole editor per step.
    let audioLevels = AudioLevelDraft()
    /// What you and Chirpy have said to each other lately. Published on its own
    /// so a reply arriving redraws the panel and nothing else.
    let conversation = AssistantConversation()
    /// The transcript's reading order, rebuilt only when the words or cuts move.
    let transcriptFlowCache = TranscriptFlowCache()
    /// The shape of every sound on the audio track, so an effect can be lined
    /// up against what is being said rather than guessed at.
    let audioWaveforms: AudioWaveformStore

    private let store = ProjectStore.shared
    let waveformService = WaveformService()
    private let thumbnailService = ThumbnailService()
    private let aiEditService = AIEditService()
    let overlayPlacementService = OverlayPlacementService()
    /// Where the speaker is on screen, found on this machine so a cutaway can
    /// be put somewhere else.
    let faceDetectionService = FaceDetectionService()
    let soundEffectService = SoundEffectService.shared
    private var soundPreview: NSSound?
    private var soundPreviewEnd: Task<Void, Never>?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var playbackStatusObservation: NSKeyValueObservation?
    private var itemStatusObservation: NSKeyValueObservation?
    private var seekGeneration = 0
    /// How long one frame of the finished video lasts. Read off the composition
    /// as it is built, so stepping matches the footage rather than a guess.
    private(set) var frameDuration = 1.0 / 30.0
    private var playWhenSeekFinishes = false
    private var isScrubbing = false
    private var resumePlaybackAfterScrub = false
    private var rebuilding = false
    private var rebuildGeneration = 0
    /// The project the composition the player is holding was built from.
    ///
    /// What makes it possible to tell a framing change from a real edit: see
    /// `differsOnlyInFraming`. `nil` when the player is holding nothing.
    private var builtProject: EditorProject?
    private var restorationTask: Task<Void, Never>?
    private var visualCommitTask: Task<Void, Never>?
    private var history = EditorHistory()
    private var pendingVisualUndoSnapshot: EditorProject?
    private var snapGuideClearTask: Task<Void, Never>?
    private var transientCache: [UUID: (peakCount: Int, times: [Double])] = [:]
    /// Overlay stills with the project's grade already applied, keyed by the
    /// image they came from. Regrading one on every frame of playback would be
    /// the most expensive thing the canvas does.
    var gradedOverlayImages: [ObjectIdentifier: (filter: VisualFilter, image: CGImage)] = [:]

    init() {
        isTimelineSnappingEnabled = UserDefaults.standard.object(forKey: "timelineSnappingEnabled") as? Bool ?? true
        audioWaveforms = AudioWaveformStore(service: waveformService)
        player.automaticallyWaitsToMinimizeStalling = false
        installObservers()
        restorationTask = Task { [weak self] in
            await self?.restoreProject()
            await self?.loadDictionary()
        }
        mediaAvailability.start(
            supplying: { [weak self] in self?.project.media ?? [] },
            onRestored: { [weak self] in
                // Plugging the card back in is a fix, so it should be one: the
                // composition that could not be built without those files is
                // built now, without anybody being asked to do anything.
                Task { await self?.reloadAfterRecovery() }
            }
        )
    }

    var duration: Double { project.duration }

    /// Keeps the playhead inside the timeline whenever the project changes
    /// under it. An edit that shortens the video must never leave the cursor
    /// past its end.
    private func refreshPlaybackCursor() {
        captionCueCache.refresh(for: project)
        transcriptFlowCache.refresh(for: project)
        let end = max(0, project.duration)
        if currentTime > end { currentTime = end }
        syncPlaybackCursor()
    }

    /// Resolves the transcript word under the playhead. The cursor only
    /// publishes when that word changes, which is what keeps the transcript
    /// from re-laying out every one of its tokens on every frame of playback.
    private func syncPlaybackCursor() {
        playbackCursor.setTranscriptWordID(project.transcriptWord(at: currentTime)?.id)
        playbackCursor.setCanvasItems(
            PlaybackCursor.CanvasItems(
                overlayIDs: overlays(at: currentTime).map(\.id),
                textLayerIDs: (project.textLayers ?? [])
                    .filter { $0.isVisible(at: currentTime) }
                    .map(\.id),
                captionID: captionCueCache.cue(at: currentTime)?.id
            )
        )
    }

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

    /// True when a playhead command has something to act on. Trimming already
    /// falls back to the clip under the playhead when nothing is selected, so
    /// the buttons must not claim otherwise: with a single clip loaded there is
    /// nothing to select, and the commands still work perfectly well.
    var hasPlayheadCommandTarget: Bool { !commandTimelineSelection().isEmpty }

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
            timelineDrag.clear()
            return
        }
        let clamped = min(duration - bounds.end, max(-bounds.start, delta))
        timelineDrag.claimIfNeeded()
        let plan = reorderPlan(for: clamped)
        // One tap when the drop actually moves to a different place in the
        // running order, rather than one per pixel of pointer travel.
        if plan?.insertionIndex != timelineDrag.reorderPlan?.insertionIndex {
            TimelineHaptics.settled()
        }
        timelineDrag.setOffset(clamped, plan: plan)
    }

    func cancelTimelineSelectionMove() {
        timelineDrag.clear()
    }

    /// Shared by the drag preview and the drop so both resolve to the same
    /// index; computing it twice from separate code drifted them apart.
    private func reorderPlan(for delta: Double) -> TimelineReorderPlan? {
        let draggedIDs = draggedClipIDs
        guard !draggedIDs.isEmpty else { return nil }
        let block = project.clips.filter { draggedIDs.contains($0.id) }
        guard !block.isEmpty else { return nil }
        let blockDuration = block.reduce(0) { $0 + $1.duration }
        let blockStart = block.compactMap { project.timelineStart(for: $0.id) }.min() ?? 0
        let remaining = project.clips.filter { !draggedIDs.contains($0.id) }
        let target = TimelineReorderGeometry.targetStart(
            blockStart: blockStart,
            delta: delta,
            blockDuration: blockDuration,
            projectDuration: project.duration
        )
        return TimelineReorderPlan(
            insertionIndex: TimelineReorderGeometry.insertionIndex(
                targetStart: target,
                remainingDurations: remaining.map(\.duration)
            ),
            blockDuration: blockDuration
        )
    }

    var draggedClipIDs: Set<UUID> {
        Set(timelineSelection.compactMap { item -> UUID? in
            if case let .clip(id) = item { return id }
            return nil
        })
    }

    func commitTimelineSelectionMove() async {
        let delta = timelineSelectionDragDelta
        let committedPlan = timelineReorderPlan ?? reorderPlan(for: delta)
        timelineDrag.clear()
        guard abs(delta) > 0.000_001, !timelineSelection.isEmpty else { return }
        let undoSnapshot = prepareUndoSnapshot()

        let selectedClipIDs = draggedClipIDs
        if !selectedClipIDs.isEmpty, let plan = committedPlan {
            let block = project.clips.filter { selectedClipIDs.contains($0.id) }
            if !block.isEmpty {
                var reordered = project.clips.filter { !selectedClipIDs.contains($0.id) }
                reordered.insert(contentsOf: block, at: min(plan.insertionIndex, reordered.count))
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
        for item in timelineSelection {
            guard case let .caption(id) = item else { continue }
            nudgeCaption(id, by: delta)
        }
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
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
        case let .caption(id):
            guard let cue = captionCueCache.cue(id) else { return nil }
            return (cue.timelineStart, cue.timelineEnd)
        case let .audio(id):
            guard let layer = project.audioLayers?.first(where: { $0.id == id }) else { return nil }
            return (layer.timelineStart, layer.timelineStart + layer.duration)
        }
    }

    private func timelineSelectionOrder(_ lhs: TimelineSelectionItem, _ rhs: TimelineSelectionItem) -> Bool {
        (timelineSpan(for: lhs)?.start ?? 0) < (timelineSpan(for: rhs)?.start ?? 0)
    }

    private func applyInspectorSelection(_ item: TimelineSelectionItem) {
        // Asking for the inspector is a request, not a state: it carries a new
        // id every time so that clicking the same item twice reopens the panel.
        // That makes re-selecting something already selected an event, and an
        // event mid-drag republishes and relays out the editor underneath the
        // gesture. Only a selection that actually changes asks.
        let wasAlreadySelected: Bool
        switch item {
        case let .clip(id): wasAlreadySelected = selectedClipID == id
        case let .text(id): wasAlreadySelected = selectedTextLayerID == id
        case let .overlay(id): wasAlreadySelected = selectedOverlayID == id
        case let .caption(id): wasAlreadySelected = selectedCaptionIDs == [id]
        case let .audio(id): wasAlreadySelected = selectedAudioLayerID == id
        }

        switch item {
        case let .clip(id):
            selectedClipID = id
        case let .text(id):
            selectedTextLayerID = id
        case let .overlay(id):
            selectedOverlayID = id
        case let .caption(id):
            setSelectedCaptionIDs([id])
        case let .audio(id):
            selectedAudioLayerID = id
        }

        guard !wasAlreadySelected else { return }
        switch item {
        case .clip: break
        case .text: inspectorRequest = EditorInspectorRequest(tool: "Text")
        case .overlay: inspectorRequest = EditorInspectorRequest(tool: "Overlays")
        case .caption: inspectorRequest = EditorInspectorRequest(tool: "Captions")
        case .audio: inspectorRequest = EditorInspectorRequest(tool: "Audio")
        }
    }

    private func syncInspectorSelection(preferred item: TimelineSelectionItem?) {
        selectedClipID = nil
        selectedTextLayerID = nil
        selectedAudioLayerID = nil
        selectedOverlayID = nil
        // Captions were left out of this, so picking a text layer left the
        // caption still selected: both drew handles on the canvas, and it was
        // anyone's guess which one a drag would move.
        selectedCaptionIDs = []
        // Picking anything else puts the picture back down. Two things drawing
        // handles on the canvas at once is how a drag becomes a guess.
        isVideoFrameSelected = false
        if let item { applyInspectorSelection(item) }
    }

    func toggleTimelineSnapping() {
        isTimelineSnappingEnabled.toggle()
        if !isTimelineSnappingEnabled { setActiveTimelineSnap(nil) }
    }

    func setAspectRatio(_ aspectRatio: ProjectAspectRatio) async {
        guard project.selectedAspectRatio != aspectRatio else { return }
        let undoSnapshot = prepareUndoSnapshot()
        project.aspectRatio = aspectRatio
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
        statusMessage = "Frame set to \(aspectRatio.title)"
    }

    func setActiveTimelineSnap(_ match: TimelineSnapMatch?) {
        let current = timelineDrag.snap
        let targetChanged = current?.time != match?.time || current?.kind != match?.kind
        // Distance changes on every pointer event but the visible guide does
        // not use it. Publishing those changes invalidated every clip view and
        // made precision trimming feel sticky. Only publish a target change.
        guard targetChanged else { return }
        snapGuideClearTask?.cancel()
        if let kind = match?.kind {
            TimelineHaptics.snapped(to: kind)
        }
        timelineDrag.setSnap(match)
        guard match != nil else { return }
        snapGuideClearTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            self?.timelineDrag.setSnap(nil)
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
        let undoSnapshot = prepareUndoSnapshot()
        isBusy = true
        errorMessage = nil
        statusMessage = "Reading media…"
        defer { isBusy = false }

        // Named back to the creator, because a video that does not appear on
        // the timeline it was just dropped into looks like an import that
        // failed rather than one that is waiting to be placed.
        var landedInBin: [String] = []

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
                // The first video is the thing being edited, so it goes down on
                // the main track. Everything imported after that is B-roll
                // until somebody says otherwise: it waits in the bin, where
                // Add, Overlay and @ can all reach it. Laying it on the main
                // track automatically both buried it under the footage and hid
                // it from the assistant, which will not offer main-track
                // footage as a cutaway over itself.
                if !media.isImage, project.clips.isEmpty {
                    project.clips.append(
                        TimelineClip(
                            mediaID: media.id,
                            sourceStart: 0,
                            sourceEnd: media.duration
                        )
                    )
                } else if !media.isImage {
                    landedInBin.append(media.name)
                }
                if project.name == "Untitled project" {
                    project.name = canonical.deletingPathExtension().lastPathComponent
                }
                selectedClipID = project.clips.last?.id
            }
            project.updatedAt = Date()
            try await rebuildComposition(preserveTime: false)
            await persist()
            recordHistory(before: undoSnapshot)
            statusMessage = landedInBin.isEmpty
                ? "Ready"
                : "\(landedInBin.joined(separator: ", ")) added to Media · use Overlay, Add, or @ it"
        } catch {
            show(error)
        }
    }

    func togglePlayback() {
        // The player's own status is the only honest answer to "is it running".
        // Tracking it in a flag let the two disagree, and a first click that
        // only paused a player which had already stopped read as a dead button.
        if player.timeControlStatus != .paused {
            pausePlayback()
            return
        }
        guard player.currentItem != nil, duration > 0 else { return }
        // Playing to the end leaves the player parked there. Asking it to play
        // again from that spot does nothing at all, so the transport has to
        // rewind first.
        if isParkedAtEnd || currentTime >= duration - 0.02 {
            seek(to: 0, exact: true, playAfter: true)
            return
        }
        if player.currentItem?.status == .readyToPlay {
            player.playImmediately(atRate: 1)
        } else {
            seek(to: currentTime, exact: false, playAfter: true)
        }
    }

    /// Whether the player is sitting on the last frame of its item.
    private var isParkedAtEnd: Bool {
        guard let item = player.currentItem else { return false }
        let end = item.duration.seconds
        guard end.isFinite, end > 0 else { return false }
        return item.currentTime().seconds >= end - 0.05
    }

    /// `isPlaying` follows the player through its status observer, so pausing
    /// only has to tell the player and cancel any play a seek still owes.
    func pausePlayback() {
        player.pause()
        playWhenSeekFinishes = false
    }

    func scrub(to time: Double) {
        beginScrubbing()
        seek(to: time, exact: false, playAfter: false)
    }

    func finishScrubbing(at time: Double) {
        beginScrubbing()
        let shouldResume = resumePlaybackAfterScrub
        isScrubbing = false
        resumePlaybackAfterScrub = false
        seek(to: time, exact: true, playAfter: shouldResume)
    }

    private func beginScrubbing() {
        guard !isScrubbing else { return }
        resumePlaybackAfterScrub = player.timeControlStatus != .paused
        isScrubbing = true
        pausePlayback()
    }

    /// Nudges the playhead by whole frames, which is the smallest move the
    /// video has. What the arrow keys do after a click has landed the playhead
    /// roughly where it belongs.
    func stepPlayhead(frames: Int) {
        guard player.currentItem != nil, duration > 0, frames != 0 else { return }
        pausePlayback()
        let step = frameDuration * Double(frames)
        let target = min(max(0, currentTime + step), duration)
        guard abs(target - currentTime) > 0.000_1 else { return }
        seek(to: target, exact: true, playAfter: false)
    }

    func seekToTimelineTime(_ time: Double) {
        pausePlayback()
        seek(to: min(max(0, time), duration), exact: true, playAfter: false)
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
        let undoSnapshot = prepareUndoSnapshot()
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
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
    }

    func restoreTranscriptWord(_ word: TranscriptWord) async {
        await restoreTranscriptWords([word])
    }

    func restoreTranscriptWords(_ words: [TranscriptWord]) async {
        let deletedWords = words.filter { !project.isWordKept($0) }
        let deletedIDs = Set(deletedWords.map(\.id))
        guard let firstWord = deletedWords.first, !deletedIDs.isEmpty else { return }
        let undoSnapshot = prepareUndoSnapshot()
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
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
        seek(to: currentTime, exact: true, playAfter: false)
    }

    func deleteTranscriptPause(mediaID: UUID, start: Double, end: Double) async {
        guard end - start >= 0.02,
              project.isSourceRangeKept(mediaID: mediaID, start: start, end: end)
        else { return }
        let undoSnapshot = prepareUndoSnapshot()
        project.removeSourceRanges([(start, end)], for: mediaID)
        currentTime = min(currentTime, project.duration)
        selectedClipID = project.clip(at: currentTime).map { project.clips[$0.index].id }
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
    }

    func restoreTranscriptPause(mediaID: UUID, start: Double, end: Double) async {
        guard end - start >= 0.02,
              !project.isSourceRangeKept(mediaID: mediaID, start: start, end: end)
        else { return }
        let undoSnapshot = prepareUndoSnapshot()
        project.restoreSourceRange((start, end), for: mediaID)
        let marker = TranscriptWord(mediaID: mediaID, text: "", start: start, end: end)
        currentTime = project.nearestTimelineTime(for: marker)
        selectedClipID = project.clip(at: currentTime).map { project.clips[$0.index].id }
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
        seek(to: currentTime, exact: true, playAfter: false)
    }

    func splitAtPlayhead() async {
        let undoSnapshot = prepareUndoSnapshot()
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
                    appearance: layer.appearance
                )
                project.textLayers?.replaceSubrange(index ... index, with: [left, right])
                resultingSelection.insert(.text(right.id))
                didSplit = true
            case let .caption(id):
                guard let cue = captionCueCache.cue(id),
                      currentTime > cue.timelineStart + 0.02,
                      currentTime < cue.timelineEnd - 0.02,
                      let tailID = project.splitCaption(
                          id,
                          afterWords: captionWordsBeforePlayhead(id)
                      ) else { continue }
                resultingSelection.insert(.caption(tailID))
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
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
    }

    func deleteSelected() async {
        await deleteTimelineSelection()
    }

    func deleteTimelineSelection() async {
        let selection = commandTimelineSelection()
        guard !selection.isEmpty else { return }
        let undoSnapshot = prepareUndoSnapshot()
        let clipIDs = Set(selection.compactMap { if case let .clip(id) = $0 { id } else { nil } })
        let textIDs = Set(selection.compactMap { if case let .text(id) = $0 { id } else { nil } })
        let overlayIDs = Set(selection.compactMap { if case let .overlay(id) = $0 { id } else { nil } })
        let audioIDs = Set(selection.compactMap { if case let .audio(id) = $0 { id } else { nil } })
        project.clips.removeAll { clipIDs.contains($0.id) }
        project.textLayers?.removeAll { textIDs.contains($0.id) }
        project.overlays?.removeAll { overlayIDs.contains($0.id) }
        project.audioLayers?.removeAll { audioIDs.contains($0.id) }
        for item in selection {
            guard case let .caption(id) = item else { continue }
            project.removeCaption(id)
        }
        setTimelineSelection([])
        currentTime = min(currentTime, project.duration)
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
    }

    func trimTimelineSelection(toPlayhead edge: TimelineEditEdge) async {
        let selection = commandTimelineSelection()
        guard !selection.isEmpty else { return }
        let undoSnapshot = prepareUndoSnapshot()
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
            case let .caption(id):
                guard let cue = captionCueCache.cue(id),
                      currentTime > cue.timelineStart + 0.02,
                      currentTime < cue.timelineEnd - 0.02 else { continue }
                let retimed = project.retimeCaption(
                    id,
                    toTimelineStart: edge == .leading ? currentTime : cue.timelineStart,
                    end: edge == .leading ? cue.timelineEnd : currentTime
                )
                if retimed { changed = true }
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
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
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
        let undoSnapshot = prepareUndoSnapshot()
        project.clips[index] = updated
        selectedClipID = updated.id
        timelineSelection = [.clip(updated.id)]
        currentTime = min(currentTime, project.duration)
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
    }

    func appendMediaToTimeline(_ mediaID: UUID) async {
        guard let media = project.media.first(where: { $0.id == mediaID }), !media.isImage else { return }
        let undoSnapshot = prepareUndoSnapshot()
        project.clips.append(
            TimelineClip(
                mediaID: media.id,
                sourceStart: 0,
                sourceEnd: media.duration
            )
        )
        selectedClipID = project.clips.last?.id
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
    }

    func resetMediaToSource(_ mediaID: UUID) async {
        guard let media = project.media.first(where: { $0.id == mediaID }), !media.isImage else { return }
        let undoSnapshot = prepareUndoSnapshot()
        guard let replacement = project.resetMainTrack(
            mediaID: mediaID,
            sourceDuration: media.duration
        ) else { return }
        selectedClipID = replacement.id
        timelineSelection = [.clip(replacement.id)]
        currentTime = project.timelineStart(for: replacement.id) ?? 0
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
        statusMessage = "Reset \(media.name) to its full source · ⌘Z to undo"
    }

    func deleteImportedMedia(_ mediaID: UUID) async {
        await deleteImportedMedia([mediaID])
    }

    /// Removes several files in one edit, so clearing a bin full of takes is
    /// one gesture and comes back with one ⌘Z rather than a dozen.
    func deleteImportedMedia(_ mediaIDs: [UUID]) async {
        let wanted = Set(mediaIDs)
        let doomed = project.media.filter { wanted.contains($0.id) }
        guard !doomed.isEmpty else { return }
        let undoSnapshot = prepareUndoSnapshot()
        var removed: [String] = []
        for media in doomed {
            guard project.removeImportedMedia(media.id) else { continue }
            waveformByMedia.removeValue(forKey: media.id)
            waveformProgressByMedia.removeValue(forKey: media.id)
            thumbnailsByMedia.removeValue(forKey: media.id)
            removed.append(media.name)
        }
        guard !removed.isEmpty else { return }
        mediaSelection = mediaSelection.reconciled(against: project.media.map(\.id))
        reconcileSelectionAfterProjectChange()
        currentTime = min(currentTime, project.duration)
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
        let what = removed.count == 1 ? removed[0] : "\(removed.count) files"
        let kept = removed.count == 1 ? "source file kept" : "source files kept"
        statusMessage = "Removed \(what) from this project · \(kept) · ⌘Z to undo"
    }

    func addOverlay(_ mediaID: UUID) async {
        guard
            duration > 0,
            let media = project.media.first(where: { $0.id == mediaID })
        else { return }
        let undoSnapshot = prepareUndoSnapshot()
        let start = min(currentTime, max(0, duration - 0.1))
        let available = max(0.1, duration - start)
        let overlayDuration = min(available, media.isImage ? 4 : media.duration)
        let overlay = introducedOverlay(
            media: media,
            timelineStart: start,
            duration: overlayDuration
        )
        project.overlays = (project.overlays ?? []) + [overlay]
        selectTimelineItem(.overlay(overlay.id))
        inspectorRequest = EditorInspectorRequest(tool: "Overlays")
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
    }

    /// An overlay sized to its media before it ever reaches the frame: media
    /// cut to the video's own shape covers it, anything else lands as a card.
    ///
    /// It also lands on the lowest lane that is free at that moment, so adding
    /// a second overlay over the first stacks it rather than refusing.
    /// - Parameter box: where it should land, when something has already worked
    ///   that out. Placing overlays with AI passes the box `OverlayLayout`
    ///   solved around the speaker; everything else leaves this alone and gets
    ///   the default card.
    func introducedOverlay(
        media: ProjectMedia,
        timelineStart: Double,
        duration: Double,
        sourceStart: Double = 0,
        alongside existing: [ProjectOverlay]? = nil,
        box solved: OverlayBox? = nil
    ) -> ProjectOverlay {
        let box = solved ?? {
            let introduced = OverlayFrame.introduced(
                mediaAspect: CompositionBuilder.aspect(of: media),
                frameAspect: project.resolvedAspectRatio
            )
            return OverlayBox(
                x: introduced.x,
                y: introduced.y,
                width: introduced.width,
                height: introduced.height
            )
        }()
        let id = UUID()
        let track = OverlayTracks.firstFreeTrack(
            for: (id, timelineStart, duration),
            in: existing ?? project.overlays ?? []
        )
        return ProjectOverlay(
            id: id,
            mediaID: media.id,
            timelineStart: timelineStart,
            duration: duration,
            sourceStart: sourceStart,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            track: track == 0 ? nil : track
        )
    }

    /// Lifts a clip onto an overlay lane, landing it where it was dropped.
    func promoteClipToOverlay(
        _ clipID: UUID,
        start: Double? = nil,
        lane: Int? = nil
    ) async {
        let undoSnapshot = prepareUndoSnapshot()
        guard let overlay = project.promoteClipToOverlay(clipID, start: start, lane: lane) else {
            setStatus("A clip has to stay on the video track")
            return
        }
        selectTimelineItem(.overlay(overlay.id))
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
        setStatus("Lifted to overlay lane \(overlay.lane + 1) · ⌘Z to undo")
    }

    func addTextLayer(asHook: Bool = false) {
        guard duration > 0 else { return }
        let undoSnapshot = prepareUndoSnapshot()
        let span = TextLayerPlacement.span(
            asHook: asHook,
            currentTime: currentTime,
            projectDuration: duration
        )
        let layer = ProjectTextLayer(
            text: asHook ? "Your hook" : "Text",
            timelineStart: span.start,
            duration: span.duration,
            y: asHook ? 0.14 : 0.5,
            width: asHook ? 0.74 : 0.7,
            appearance: asHook ? .hookDefault : .textLayerDefault
        )
        var layers = project.textLayers ?? []
        layers.append(layer)
        project.textLayers = layers
        selectedTextLayerID = layer.id
        timelineSelection = [.text(layer.id)]
        inspectorRequest = EditorInspectorRequest(tool: "Text")
        project.updatedAt = Date()
        scheduleVisualCommit(undoSnapshot: undoSnapshot)
    }

    /// Plays an effect to hear it, and says which one is playing.
    ///
    /// Which one matters: a ten-second typing loop started by accident had no
    /// way to be stopped except waiting it out, because nothing on screen knew
    /// a preview was running.
    func previewSoundEffect(_ effect: SoundEffectDescriptor) async {
        do {
            let url = try await soundEffectService.fileURL(for: effect)
            soundPreview?.stop()
            soundPreview = NSSound(contentsOf: url, byReference: true)
            soundPreview?.play()
            previewingSoundID = effect.id
            // Cleared when it finishes on its own, so the button goes back to
            // offering a play rather than a stop for a sound already over.
            soundPreviewEnd?.cancel()
            soundPreviewEnd = Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(Int(effect.duration * 1000) + 120))
                guard !Task.isCancelled, let self, previewingSoundID == effect.id else { return }
                previewingSoundID = nil
                soundPreview = nil
            }
        } catch {
            show(error)
        }
    }

    /// Stops whatever is being previewed, now.
    func stopSoundPreview() {
        soundPreviewEnd?.cancel()
        soundPreviewEnd = nil
        soundPreview?.stop()
        soundPreview = nil
        previewingSoundID = nil
    }

    func addSoundEffect(_ effect: SoundEffectDescriptor) async {
        guard duration > 0 else { return }
        do {
            let undoSnapshot = prepareUndoSnapshot()
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
            await commitTimelineEdit(undoSnapshot: undoSnapshot)
        } catch {
            show(error)
        }
    }

    /// - Parameter startingAt: where the first sound lands, for a drop that
    ///   named its own moment. The playhead otherwise, which is what the import
    ///   button means.
    func importAudio(_ urls: [URL], startingAt: Double? = nil) async {
        guard duration > 0, !urls.isEmpty else { return }
        do {
            let undoSnapshot = prepareUndoSnapshot()
            var insertionTime = min(startingAt ?? currentTime, max(0, duration - 0.02))
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
            await commitTimelineEdit(undoSnapshot: undoSnapshot)
        } catch {
            show(error)
        }
    }

    func selectAudioLayer(_ id: UUID) {
        selectTimelineItem(.audio(id))
    }

    func updateAudioLayer(_ updated: ProjectAudioLayer) async {
        guard let index = project.audioLayers?.firstIndex(where: { $0.id == updated.id }) else { return }
        let undoSnapshot = prepareUndoSnapshot()
        project.audioLayers?[index] = updated
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
    }

    func deleteSelectedAudioLayer() async {
        guard let selectedAudioLayerID else { return }
        let undoSnapshot = prepareUndoSnapshot()
        project.audioLayers?.removeAll { $0.id == selectedAudioLayerID }
        self.selectedAudioLayerID = project.audioLayers?.last?.id
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
    }

    func selectOverlay(_ id: UUID) {
        selectTimelineItem(.overlay(id))
    }

    func commitAudioTrim(_ updated: ProjectAudioLayer) async {
        guard let index = project.audioLayers?.firstIndex(where: { $0.id == updated.id }) else { return }
        let undoSnapshot = prepareUndoSnapshot()
        project.audioLayers?[index] = updated
        selectedAudioLayerID = updated.id
        await commitTimelineEdit(undoSnapshot: undoSnapshot)
    }

    func selectTextLayer(_ id: UUID) {
        selectTimelineItem(.text(id))
    }

    func updateTextLayer(_ updated: ProjectTextLayer) {
        guard let index = project.textLayers?.firstIndex(where: { $0.id == updated.id }) else { return }
        let undoSnapshot = project
        project.textLayers?[index] = updated
        project.updatedAt = Date()
        scheduleVisualCommit(undoSnapshot: undoSnapshot)
    }

    func deleteSelectedTextLayer() {
        guard let selectedTextLayerID else { return }
        let undoSnapshot = prepareUndoSnapshot()
        project.textLayers?.removeAll { $0.id == selectedTextLayerID }
        self.selectedTextLayerID = project.textLayers?.last?.id
        project.updatedAt = Date()
        scheduleVisualCommit(undoSnapshot: undoSnapshot)
    }

    func transcribeProject() async {
        guard !project.clips.isEmpty, !isAIEditing else { return }
        let undoSnapshot = prepareUndoSnapshot()
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
                let words = try await aiEditService.transcribe(media: media, dictionary: dictionaryEntries)
                var transcript = project.transcript ?? []
                transcript.removeAll { $0.mediaID == mediaID }
                transcript.append(contentsOf: words)
                project.transcript = transcript
                aiProgress = Double(index + 1) / Double(max(1, mediaIDs.count))
            }
            project.updatedAt = Date()
            await persist()
            recordHistory(before: undoSnapshot)
            statusMessage = "Transcript ready · \(project.timelineTranscript.count) words"
        } catch {
            show(error)
        }
    }

    func runOneClickEdit() async {
        guard !project.clips.isEmpty, !isAIEditing else { return }
        let original = prepareUndoSnapshot()
        isAIEditing = true
        isBusy = true
        aiProgress = 0
        oneClickEditStage = .preparing
        errorMessage = nil
        defer {
            oneClickEditStage = nil
            isAIEditing = false
            isBusy = false
        }

        do {
            let mediaIDs = Array(Set(project.clips.map(\.mediaID)))
            for (index, mediaID) in mediaIDs.enumerated() {
                guard let media = project.media.first(where: { $0.id == mediaID }) else { continue }
                var words = (project.transcript ?? []).filter { $0.mediaID == mediaID }
                if words.isEmpty {
                    setOneClickEditStage(.transcribing)
                    words = try await aiEditService.transcribe(media: media, dictionary: dictionaryEntries)
                    var transcript = project.transcript ?? []
                    transcript.removeAll { $0.mediaID == mediaID }
                    transcript.append(contentsOf: words)
                    project.transcript = transcript
                }
                guard !words.isEmpty else {
                    throw NativeEditorError.aiFailed("No spoken words were found in \(media.name).")
                }

                setOneClickEditStage(.removingRetakes)
                let cuts = try await aiEditService.cleanCuts(words: words)
                setOneClickEditStage(.cuttingPauses)
                let ranges = await aiEditService.autoEditRanges(
                    words: words,
                    duration: media.duration,
                    aiCuts: cuts,
                    url: media.url
                )
                project.removeSourceRanges(ranges, for: mediaID)
                setOneClickEditStage(.trimmingSilence)
                aiProgress = Double(index + 1) / Double(max(1, mediaIDs.count))
            }
            guard !project.clips.isEmpty else {
                project = original
                throw NativeEditorError.aiFailed("The proposed edit was empty, so the original was restored.")
            }
            setOneClickEditStage(.addingCaptions)
            project.regenerateCaptions()
            setSelectedCaptionIDs([])
            selectedClipID = project.clips.first?.id
            currentTime = 0
            try await rebuildComposition(preserveTime: false)
            await persist()
            recordHistory(before: original)
            statusMessage = "1-Click Edit + captions complete · \(project.clips.count) clips"
        } catch {
            project = original
            show(error)
        }
    }

    /// The Captions on/off switch. Turning them off keeps the cards so the
    /// creator's text edits and restyling survive turning them back on.
    func toggleCaptions() async {
        guard !project.clips.isEmpty, !isAIEditing else { return }
        if project.captionsEnabled == true {
            let undoSnapshot = prepareUndoSnapshot()
            project.setCaptionsVisible(false)
            await persist()
            recordHistory(before: undoSnapshot)
            statusMessage = "Captions hidden · \(project.storedCaptions.count) cards kept"
            return
        }
        if !project.storedCaptions.isEmpty {
            let undoSnapshot = prepareUndoSnapshot()
            project.setCaptionsVisible(true)
            await persist()
            recordHistory(before: undoSnapshot)
            statusMessage = "Captions shown · \(project.captionEntries.count) cards"
            return
        }
        await generateCaptions()
    }

    /// Rebuilds every card from the current transcript and cut, transcribing
    /// first if the project has never been listened to. Regeneration is always
    /// explicit, so hand-edited text is never silently thrown away.
    func generateCaptions() async {
        guard !project.clips.isEmpty, !isAIEditing else { return }
        let undoSnapshot = prepareUndoSnapshot()
        isAIEditing = true
        isBusy = true
        errorMessage = nil
        defer {
            isAIEditing = false
            isBusy = false
        }
        do {
            let mediaIDs = Array(Set(project.clips.map(\.mediaID)))
            for mediaID in mediaIDs {
                guard
                    !(project.transcript ?? []).contains(where: { $0.mediaID == mediaID }),
                    let media = project.media.first(where: { $0.id == mediaID })
                else { continue }
                statusMessage = "Transcribing before adding captions…"
                let words = try await aiEditService.transcribe(media: media, dictionary: dictionaryEntries)
                var transcript = project.transcript ?? []
                transcript.removeAll { $0.mediaID == mediaID }
                transcript.append(contentsOf: words)
                project.transcript = transcript
            }
            guard !project.timelineTranscript.isEmpty else {
                throw NativeEditorError.aiFailed("No spoken words were found to caption.")
            }
            project.regenerateCaptions()
            setSelectedCaptionIDs([])
            await persist()
            recordHistory(before: undoSnapshot)
            statusMessage = "Captions ready · \(project.captionEntries.count) cards"
        } catch {
            project = undoSnapshot
            show(error)
        }
    }

    func autoTrimSilences() async {
        guard !project.clips.isEmpty, !isAIEditing else { return }
        let original = prepareUndoSnapshot()
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
                    words = try await aiEditService.transcribe(media: media, dictionary: dictionaryEntries)
                    var transcript = project.transcript ?? []
                    transcript.removeAll { $0.mediaID == mediaID }
                    transcript.append(contentsOf: words)
                    project.transcript = transcript
                }
                guard !words.isEmpty else { continue }
                statusMessage = "Trimming silent gaps…"
                let ranges = await aiEditService.silenceRanges(
                    words: words,
                    duration: media.duration,
                    url: media.url
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
            recordHistory(before: original)
            statusMessage = "Auto-trim complete · \(project.clips.count) clips"
        } catch {
            project = original
            show(error)
        }
    }

    func dismissError() {
        errorMessage = nil
    }

    func undo() async {
        await restoreHistorySnapshot(direction: .undo)
    }

    func redo() async {
        await restoreHistorySnapshot(direction: .redo)
    }

    private enum HistoryDirection {
        case undo
        case redo
    }

    private func restoreHistorySnapshot(direction: HistoryDirection) async {
        guard !isBusy, !isExporting else { return }
        finalizePendingVisualHistory()
        let current = project
        let target: EditorProject?
        switch direction {
        case .undo:
            target = history.undo(current: current)
        case .redo:
            target = history.redo(current: current)
        }
        guard let target else {
            syncHistoryAvailability()
            return
        }

        pausePlayback()
        project = target
        reconcileSelectionAfterProjectChange()
        currentTime = min(currentTime, project.duration)
        do {
            try await rebuildComposition(preserveTime: true)
            await persist()
            statusMessage = direction == .undo ? "Undo" : "Redo"
        } catch {
            project = current
            switch direction {
            case .undo:
                _ = history.redo(current: target)
            case .redo:
                _ = history.undo(current: target)
            }
            reconcileSelectionAfterProjectChange()
            show(error)
        }
        syncHistoryAvailability()
    }

    /// The seam an edit that changes the composition goes through: rebuild the
    /// player item, save, and record one undo step. Focused extensions on this
    /// session use it, which is why it is not private.
    func commitTimelineEdit(undoSnapshot: EditorProject? = nil) async {
        project.updatedAt = Date()
        do {
            try await rebuildComposition(preserveTime: true)
            await persist()
            if let undoSnapshot { recordHistory(before: undoSnapshot) }
            statusMessage = "Ready"
        } catch {
            show(error)
        }
    }

    private func setOneClickEditStage(_ stage: OneClickEditStage) {
        oneClickEditStage = stage
        aiProgress = Double(stage.rawValue) / Double(max(1, OneClickEditStage.allCases.count - 1))
        statusMessage = stage.title
    }

    /// The one seam the focused intent extensions (captions, and anything that
    /// follows) use to change the project. Keeping it explicit means every
    /// mutation outside this file is greppable, without opening the setter to
    /// the views.
    func updateProject(_ change: (inout EditorProject) -> Void) {
        change(&project)
    }

    func setStatus(_ message: String) {
        statusMessage = message
    }

    func setBusy(_ busy: Bool) {
        isBusy = busy
    }

    func setOverlayPlacement(_ status: OverlayPlacementStatus) {
        overlayPlacement = status
    }

    /// The one seam caption selection goes through, so selecting a card here
    /// puts down whatever else was held on the canvas.
    /// Brings a selected item into view on the canvas.
    ///
    /// A caption, an overlay or a text layer is only drawn while the playhead
    /// is inside it, so picking one on the timeline while the playhead sits
    /// somewhere else selected something invisible: the handles were on a card
    /// that was not on screen, and there was nothing to drag in the preview.
    /// The playhead moves to the item only when it is not already inside it.
    func revealOnCanvas(_ item: TimelineSelectionItem) {
        guard let span = timelineSpan(for: item) else { return }
        guard currentTime < span.start || currentTime > span.end else { return }
        // Just inside the leading edge, so the item really is on screen rather
        // than exactly on the boundary where it starts.
        seekToTimelineTime(min(span.end, span.start + 0.05))
    }

    /// Puts down everything on the canvas: the picture, the captions, the text
    /// and the overlays.
    ///
    /// What a click on the workspace around the stage does, and what Escape
    /// does. There was no way to do this at all before: every canvas item could
    /// be picked up and none of them could be put back down except by picking
    /// up another one, so a dashed box sat on the last thing you touched for
    /// the rest of the session.
    ///
    /// The timeline selection is deliberately left alone. The timeline keeps a
    /// clip selected nearly all the time and the inspector follows it, so
    /// clearing it here would empty a panel on the other side of the window
    /// over a click that was about the picture.
    func clearCanvasSelection() {
        isVideoFrameSelected = false
        selectedOverlayID = nil
        selectedTextLayerID = nil
        setSelectedCaptionIDs([])
    }

    func setSelectedCaptionIDs(_ ids: Set<UUID>) {
        selectedCaptionIDs = ids
        guard !ids.isEmpty else { return }
        selectedTextLayerID = nil
        selectedOverlayID = nil
    }

    func scheduleVisualCommit(undoSnapshot: EditorProject) {
        if pendingVisualUndoSnapshot == nil {
            pendingVisualUndoSnapshot = undoSnapshot
        }
        visualCommitTask?.cancel()
        visualCommitTask = Task { [weak self] in
            do {
                try await Task.sleep(for: .milliseconds(140))
                guard !Task.isCancelled, let self else { return }
                // Text is rendered directly over the native player. Persisting
                // must never swap the player item or interrupt active playback.
                await self.persist()
                self.finalizePendingVisualHistory(cancelTask: false)
                self.statusMessage = "Ready"
            } catch is CancellationError {
                return
            } catch {
                self?.show(error)
            }
        }
    }

    /// Like `scheduleVisualCommit`, for edits the composition itself has to be
    /// rebuilt for: a video cutaway moving, or being resized. Rebuilding on
    /// every step of a gesture would stutter, so the last one wins and the
    /// whole gesture lands as a single undo step.
    func scheduleCompositionCommit(undoSnapshot: EditorProject, settleFor delay: Duration = .milliseconds(220)) {
        if pendingVisualUndoSnapshot == nil {
            pendingVisualUndoSnapshot = undoSnapshot
        }
        visualCommitTask?.cancel()
        var run = EditLatencyLog.Run("composition commit")
        visualCommitTask = Task { [weak self] in
            do {
                try await Task.sleep(for: delay)
                guard !Task.isCancelled, let self else { return }
                run.mark("settled")
                try await self.rebuildComposition(preserveTime: true, run: &run)
                run.mark("composition shown")
                await self.persist()
                run.mark("saved")
                self.finalizePendingVisualHistory(cancelTask: false)
                self.statusMessage = "Ready"
            } catch is CancellationError {
                return
            } catch {
                self?.show(error)
            }
        }
    }

    func prepareUndoSnapshot() -> EditorProject {
        finalizePendingVisualHistory()
        return project
    }

    private func finalizePendingVisualHistory(cancelTask: Bool = true) {
        if cancelTask { visualCommitTask?.cancel() }
        visualCommitTask = nil
        guard let snapshot = pendingVisualUndoSnapshot else { return }
        pendingVisualUndoSnapshot = nil
        recordHistory(before: snapshot)
    }

    func recordHistory(before snapshot: EditorProject) {
        history.record(before: snapshot, after: project)
        syncHistoryAvailability()
    }

    private func syncHistoryAvailability() {
        canUndo = history.canUndo
        canRedo = history.canRedo
    }

    /// Drops anything from the selection that the project no longer has, and
    /// falls back to the clip under the playhead when that empties it.
    func reconcileTimelineSelection() {
        reconcileSelectionAfterProjectChange()
    }

    private func reconcileSelectionAfterProjectChange() {
        let clipIDs = Set(project.clips.map(\.id))
        let textIDs = Set((project.textLayers ?? []).map(\.id))
        let overlayIDs = Set((project.overlays ?? []).map(\.id))
        let audioIDs = Set((project.audioLayers ?? []).map(\.id))
        let captionIDs = Set(project.captionEntries.map(\.id))
        timelineSelection = timelineSelection.filter { item in
            switch item {
            case let .clip(id): clipIDs.contains(id)
            case let .text(id): textIDs.contains(id)
            case let .overlay(id): overlayIDs.contains(id)
            case let .caption(id): captionIDs.contains(id)
            case let .audio(id): audioIDs.contains(id)
            }
        }
        if let selectedClipID, !clipIDs.contains(selectedClipID) { self.selectedClipID = nil }
        if let selectedTextLayerID, !textIDs.contains(selectedTextLayerID) { self.selectedTextLayerID = nil }
        if let selectedOverlayID, !overlayIDs.contains(selectedOverlayID) { self.selectedOverlayID = nil }
        if let selectedAudioLayerID, !audioIDs.contains(selectedAudioLayerID) { self.selectedAudioLayerID = nil }
        if timelineSelection.isEmpty,
           let hit = project.clip(at: min(currentTime, project.duration)) {
            let id = project.clips[hit.index].id
            selectedClipID = id
            timelineSelection = [.clip(id)]
        }
    }

    func rebuildComposition(preserveTime: Bool) async throws {
        var run = EditLatencyLog.Run("rebuild")
        try await rebuildComposition(preserveTime: preserveTime, run: &run)
    }

    private func rebuildComposition(preserveTime: Bool, run: inout EditLatencyLog.Run) async throws {
        guard !project.clips.isEmpty else {
            pausePlayback()
            player.replaceCurrentItem(with: nil)
            builtProject = nil
            renderedFraming.record([])
            currentTime = 0
            return
        }
        // Edits arrive in bursts: a drop lands, the undo snapshot commits, a
        // trim follows. Only the newest of them is worth building, so a request
        // that has been overtaken while waiting its turn simply stands down.
        rebuildGeneration += 1
        let generation = rebuildGeneration
        while rebuilding {
            try await Task.sleep(for: .milliseconds(4))
            guard generation == rebuildGeneration else { return }
        }
        rebuilding = true
        defer { rebuilding = false }
        run.mark("queue clear")

        let resumeAt = preserveTime ? min(currentTime, project.duration) : 0
        let resumePlayback = player.timeControlStatus != .paused
        // The project as the composition sees it. What the player ends up
        // showing is this, not whatever the project has become by the time the
        // build returns, which is the whole point of recording it below.
        let snapshot = project
        // The player draws none of the Core Animation pass, so it must not wait
        // for it: see CompositionPurpose.
        let built = try await CompositionBuilder.build(project: snapshot, for: .preview)
        run.mark("built")
        guard generation == rebuildGeneration else { return }
        if let frame = built.videoComposition?.frameDuration.seconds, frame > 0 {
            frameDuration = frame
        }
        // A framing or a volume change needs none of the upheaval below: same
        // tracks, same playhead, only a different transform laid over them and
        // a different number in the mix. Handing the item those keeps the
        // picture on screen, where swapping the item blacks the preview out for
        // as long as the exact seek back takes. See `differsOnlyInPresentation`.
        if
            let current = player.currentItem,
            let builtProject,
            builtProject.differsOnlyInPresentation(from: snapshot),
            let reframed = built.playbackVideoComposition
        {
            let levelsMoved = builtProject.audioLevelsDiffer(from: snapshot)
            current.videoComposition = reframed
            current.audioMix = built.audioMix
            self.builtProject = snapshot
            renderedFraming.record(snapshot.clips)
            run.mark("presentation swapped in")
            // Paused, AVFoundation holds the frame it last rendered and has no
            // reason to notice the composition under it has changed. Asking for
            // the frame it is already on is what makes it draw the new one.
            //
            // A mix is worse than that: handed to a running item it takes
            // effect at the next playback cycle, so a fader moved while paused
            // changed the waveform and nothing else, and moved while playing
            // did not land until the next thing that happened to seek. Asking
            // for the time it is already at starts that cycle now.
            if levelsMoved {
                refreshCurrentTime()
            } else if player.timeControlStatus == .paused {
                refreshPausedFrame()
            }
            return
        }

        let item = built.playerItem
        // Land on a rendered frame rather than showing whatever decodes first.
        item.seekingWaitsForVideoCompositionRendering = true
        _ = try await item.asset.load(.isPlayable)
        run.mark("item playable")
        guard generation == rebuildGeneration else { return }

        player.pause()
        player.replaceCurrentItem(with: item)
        builtProject = snapshot
        renderedFraming.record(snapshot.clips)
        watchForFailure(of: item)
        seek(to: resumeAt, exact: true, playAfter: resumePlayback)
        run.mark("item swapped in (the slow way)")
    }

    /// Re-serves the moment the player is on, so a new mix or composition takes
    /// effect now rather than at whatever happens next.
    ///
    /// Playing or paused: the seek is to the time it is already at, so nothing
    /// moves, and playback carries on by itself afterwards.
    private func refreshCurrentTime() {
        guard player.currentItem != nil else { return }
        let now = player.currentTime()
        player.seek(to: now, toleranceBefore: .zero, toleranceAfter: .zero)
    }

    /// Redraws the frame the player is sitting on, for a change that alters how
    /// the current time looks rather than which time is current.
    private func refreshPausedFrame() {
        guard let item = player.currentItem else { return }
        let now = item.currentTime()
        item.seek(to: now, toleranceBefore: .zero, toleranceAfter: .zero, completionHandler: nil)
    }

    /// A player item that fails shows nothing at all: the preview simply goes
    /// black, with no hint of why. This says so instead.
    private func watchForFailure(of item: AVPlayerItem) {
        itemStatusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            guard item.status == .failed else { return }
            let reason = item.error?.localizedDescription
            Task { @MainActor [weak self] in
                guard let self, self.player.currentItem === item else { return }
                self.errorMessage = reason ?? "The preview could not be built."
                self.statusMessage = "Preview failed"
            }
        }
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
                guard let self, finished, generation == self.seekGeneration else { return }
                if self.playWhenSeekFinishes {
                    self.playWhenSeekFinishes = false
                    self.player.playImmediately(atRate: 1)
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
                guard let self, !self.isScrubbing, self.player.rate != 0 else { return }
                self.currentTime = min(max(0, time.seconds), self.duration)
            }
        }
        // The transport reflects what the player is actually doing rather than
        // what it was last asked to do. A play that never got going used to
        // leave the button showing a pause icon over a still frame.
        playbackStatusObservation = player.observe(
            \.timeControlStatus,
            options: [.initial, .new]
        ) { [weak self] player, _ in
            let playing = player.timeControlStatus != .paused
            Task { @MainActor [weak self] in
                guard let self, self.isPlaying != playing else { return }
                self.isPlaying = playing
            }
        }
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            let endedItem = (notification.object as? AVPlayerItem).map(ObjectIdentifier.init)
            MainActor.assumeIsolated {
                guard
                    let self,
                    let endedItem,
                    let playing = self.player.currentItem,
                    ObjectIdentifier(playing) == endedItem
                else { return }
                // Park the playhead exactly on the end. The periodic observer
                // stops as soon as the rate hits zero, so it used to be left a
                // frame short, and the next play then asked a player sitting on
                // its last frame to carry on from there: nothing moved, and the
                // button flipped to pause anyway.
                self.pausePlayback()
                self.currentTime = self.duration
            }
        }
    }

    /// Has another go at the thumbnails and the waveform, for media whose first
    /// attempt had no file to read.
    func restartDerivedMedia(for media: ProjectMedia) {
        beginDerivedMedia(for: media)
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
                _ = try await waveformService.peaks(for: WaveformSource(media: media)) { [weak self] peaks, fraction in
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
            history.clear()
            pendingVisualUndoSnapshot = nil
            syncHistoryAvailability()
            // Restored whole, including anything the editor cannot currently
            // read. This used to drop unreachable media along with its clips,
            // its transcript, its captions and its cutaways, which meant an
            // unplugged card silently deleted the edit made on it: reopening
            // with the card out and saving once made that permanent. A file
            // that is not there right now is a file to reconnect, and every cut
            // made against it is still exactly right. See MediaAvailability.
            project = saved
            selectedClipID = project.clips.first?.id
            selectedTextLayerID = project.textLayers?.first?.id
            selectedAudioLayerID = project.audioLayers?.first?.id
            selectedOverlayID = project.overlays?.first?.id
            timelineSelection = selectedClipID.map { [.clip($0)] } ?? []
            mediaAvailability.refresh()
            for media in project.media where !offlineMedia.contains(where: { $0.id == media.id }) {
                beginDerivedMedia(for: media)
            }
            guard offlineMedia.isEmpty else {
                statusMessage = "Media offline"
                return
            }
            if !project.clips.isEmpty {
                try await rebuildComposition(preserveTime: false)
                statusMessage = "Restored \(project.name)"
            }
        } catch {
            show(error)
        }
    }

    func persist() async {
        do {
            try await store.save(project)
        } catch {
            show(error)
        }
    }

    func show(_ error: Error) {
        errorMessage = error.localizedDescription
        statusMessage = "Needs attention"
    }

    /// Wipes the last failure before starting something that might raise its
    /// own, so what is on screen belongs to the run you are watching.
    func clearError() {
        errorMessage = nil
    }

    func toggleAssistant() {
        isAssistantOpen.toggle()
    }

    /// True when there was something open to close, so Escape can go on to mean
    /// whatever else it means when there was not.
    @discardableResult
    func closeAssistant() -> Bool {
        guard isAssistantOpen else { return false }
        isAssistantOpen = false
        return true
    }
}
