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

typealias TranscriptionRunner = @Sendable (
    ProjectMedia,
    [DictionaryEntry],
    (@MainActor @Sendable (Double) -> Void)?
) async throws -> [TranscriptWord]

typealias NativeExportRunner = @Sendable (EditorProject, URL) async throws -> Void

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
    @Published private(set) var activeOperation: LongOperationLease?
    private var longOperationCoordinator = LongOperationCoordinator()
    private var pendingMediaRecovery: PendingMediaRecovery?
    var assistantRunInFlight = false
    private var captionOperationWaiters: [CheckedContinuation<Bool, Never>] = []
    var isBusy: Bool { activeOperation != nil }
    var isExporting: Bool { activeOperation?.operation.isExport == true }
    var isAIEditing: Bool { activeOperation?.operation.isAI == true }
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
    /// The last card picked in the caption list, which is what a shift-click
    /// there reaches back to.
    var captionSelectionAnchor: UUID?
    /// The last thing clicked, which is what a shift-click reaches back to.
    private var selectionAnchor: TimelineSelectionItem?
    /// The look lifted off one item, waiting to be put onto others. Held for
    /// the session rather than the system pasteboard: it is a value out of this
    /// project, and nothing outside the editor has any use for it.
    @Published var copiedProperties: CopiedProperties?
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

    private let store: any ProjectPersisting
    let waveformService = WaveformService()
    private let thumbnailService = ThumbnailService()
    private let aiEditService = AIEditService()
    private let transcriptionRunner: TranscriptionRunner?
    private let exportRunner: NativeExportRunner
    let overlayPlacementService: any OverlayPlacementPlanning
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
    /// The framing a gesture is asking for, waiting its turn to be shown in the
    /// composition. Latest wins: a drag makes far more of these than there is
    /// any point building.
    private var pendingFramingPreview: (framing: VideoFraming, clipID: UUID)?
    private var framingPreviewLoop: Task<Void, Never>?
    /// The project the composition the player is holding was built from.
    ///
    /// What makes it possible to tell a framing change from a real edit: see
    /// `differsOnlyInFraming`. `nil` when the player is holding nothing.
    private var builtProject: EditorProject?
    private var restorationTask: Task<Void, Never>?
    private var transcriptionTask: Task<Void, Never>?
    private var transcriptionToken: UUID?
    private(set) var lastTranscriptionWasCanceled = false
    private var trackedOperationTask: Task<Void, Never>?
    private var trackedOperationToken: UUID?
    private var trackedOperationReportedCancellation = false
    private var trackedOperationCancellationResults: [UUID: Bool] = [:]
    private var editCommitTask: Task<Void, Never>?
    private var history = EditorHistory()
    private var pendingEdit: PendingEdit?
    private var editCommitInFlight = false
    private var editCommitWaiters: [CheckedContinuation<Void, Never>] = []
    private var queuedScheduledEdits: [ScheduledEdit] = []
    private var nextEditRevision = 0
    private var snapGuideClearTask: Task<Void, Never>?
    private var transientCache: [UUID: (peakCount: Int, times: [Double])] = [:]
    private var derivedGenerationFence = DerivedMediaGenerationFence()
    private var thumbnailTasksByMedia: [UUID: Task<Void, Never>] = [:]
    private var waveformTasksByMedia: [UUID: Task<Void, Never>] = [:]
    var validatedMediaRevisions: [UUID: MediaResourceRevision] = [:]
    var validatedAudioRevisions: [String: MediaResourceRevision] = [:]
    /// Overlay stills with the project's grade already applied, keyed by the
    /// image they came from. Regrading one on every frame of playback would be
    /// the most expensive thing the canvas does.
    var gradedOverlayImages: [ObjectIdentifier: (filter: VisualFilter, image: CGImage)] = [:]

    init(
        store: any ProjectPersisting = ProjectStore.shared,
        overlayPlacementService: any OverlayPlacementPlanning = OverlayPlacementService(),
        transcriptionRunner: TranscriptionRunner? = nil,
        exportRunner: @escaping NativeExportRunner = ExportService.export
    ) {
        self.store = store
        self.overlayPlacementService = overlayPlacementService
        self.transcriptionRunner = transcriptionRunner
        self.exportRunner = exportRunner
        isTimelineSnappingEnabled = UserDefaults.standard.object(forKey: "timelineSnappingEnabled") as? Bool ?? true
        audioWaveforms = AudioWaveformStore(service: waveformService)
        player.automaticallyWaitsToMinimizeStalling = false
        installObservers()
        restorationTask = Task { [weak self] in
            await self?.restoreProject()
            await self?.loadDictionary()
        }
        mediaAvailability.start(
            supplying: { [weak self] in self?.project ?? EditorProject() },
            onRestored: { [weak self] in
                // Plugging the card back in is a fix, so it should be one: the
                // composition that could not be built without those files is
                // built now, without anybody being asked to do anything.
                Task {
                    await self?.recoverRestoredMedia()
                }
            },
            onResourcesChanged: { [weak self] in
                Task { await self?.verifyMediaResourcesChangedOnDisk() }
            }
        )
    }

    func beginLongOperation(_ operation: LongOperation) -> LongOperationLease? {
        guard let lease = longOperationCoordinator.acquire(operation) else { return nil }
        activeOperation = lease
        return lease
    }

    func endLongOperation(_ lease: LongOperationLease) {
        guard longOperationCoordinator.release(lease) else { return }
        activeOperation = nil
        drainPendingLongWork()
    }

    /// Owns the task as well as the operation lease, so a visible Cancel action
    /// can stop the actual export/provider work rather than merely changing UI.
    @discardableResult
    func runTrackedLongOperation(
        _ operation: LongOperation,
        perform: @escaping @MainActor (LongOperationLease) async -> Void
    ) async -> Bool {
        guard trackedOperationTask == nil, let lease = beginLongOperation(operation) else { return false }
        let task = startTrackedLongOperation(lease, perform: perform)
        await withTaskCancellationHandler {
            await task.value
        } onCancel: {
            task.cancel()
        }
        return takeTrackedCancellationResult(for: lease.token)
    }

    private func startTrackedLongOperation(
        _ lease: LongOperationLease,
        perform: @escaping @MainActor (LongOperationLease) async -> Void
    ) -> Task<Void, Never> {
        let token = lease.token
        trackedOperationReportedCancellation = false
        let task = Task { @MainActor [weak self] in
            guard let self else { return }
            await perform(lease)
            finishTrackedLongOperation(lease, token: token)
        }
        trackedOperationToken = token
        trackedOperationTask = task
        return task
    }

    private func finishTrackedLongOperation(
        _ lease: LongOperationLease,
        token: UUID
    ) {
        guard trackedOperationToken == token else { return }
        trackedOperationTask = nil
        trackedOperationToken = nil
        trackedOperationCancellationResults[token] = trackedOperationReportedCancellation
        trackedOperationReportedCancellation = false
        endLongOperation(lease)
    }

    private func takeTrackedCancellationResult(for token: UUID) -> Bool {
        trackedOperationCancellationResults.removeValue(forKey: token) ?? false
    }

    func markCurrentLongOperationCanceled() {
        guard activeOperation?.token == trackedOperationToken else { return }
        trackedOperationReportedCancellation = true
    }

    var canCancelCurrentOperation: Bool {
        if activeOperation?.operation == .transcribing { return transcriptionTask != nil }
        return activeOperation?.token == trackedOperationToken && trackedOperationTask != nil
    }

    func cancelCurrentOperation() {
        if activeOperation?.operation == .transcribing {
            cancelCurrentTranscription()
        } else {
            trackedOperationTask?.cancel()
        }
    }

    private func drainPendingLongWork() {
        if !captionOperationWaiters.isEmpty,
           let captionLease = beginLongOperation(.captions)
        {
            let waiter = captionOperationWaiters.removeFirst()
            let task = startTrackedLongOperation(captionLease) { [weak self] owner in
                await self?.performCaptionToggle(owner: owner)
            }
            Task { @MainActor in
                await task.value
                waiter.resume(returning: takeTrackedCancellationResult(for: captionLease.token))
            }
            return
        }
        guard let pendingMediaRecovery else { return }
        self.pendingMediaRecovery = nil
        Task {
            switch pendingMediaRecovery {
            case .restored: await recoverRestoredMedia()
            case .verify: await verifyMediaResourcesChangedOnDisk()
            }
        }
    }

    /// Automatic volume/path recovery participates in the same commit queue as
    /// imports, relinks, undo, and gestures, so it cannot save an older model
    /// over a newer user edit.
    func recoverRestoredMedia() async {
        guard let operation = beginLongOperation(.recoveringMedia) else {
            if pendingMediaRecovery == nil { pendingMediaRecovery = .restored }
            else { pendingMediaRecovery?.merge(.restored) }
            return
        }
        defer { endLongOperation(operation) }
        guard let rollback = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        do {
            repairBuiltInAudioURLs()
            mediaAvailability.refresh(notifyRestored: false)
            try await validateAvailableMediaIdentity()
            mediaAvailability.refresh(notifyRestored: false)
            guard mediaAvailability.requiredOffline.isEmpty else {
                let offlineIDs = Set(mediaAvailability.offline.map(\.id))
                for media in project.media where !offlineIDs.contains(media.id) {
                    await restartDerivedMedia(for: media)
                }
                statusMessage = "Some media is still offline"
                return
            }
            try await reloadAfterRecovery()
        } catch {
            await restoreEditState(rollback, rebuildPlayer: true, preserving: error)
        }
    }

    func verifyMediaResourcesChangedOnDisk() async {
        guard let operation = beginLongOperation(.recoveringMedia) else {
            if pendingMediaRecovery == nil { pendingMediaRecovery = .verify }
            else { pendingMediaRecovery?.merge(.verify) }
            return
        }
        defer { endLongOperation(operation) }
        guard let rollback = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        validatedMediaRevisions.removeAll()
        validatedAudioRevisions.removeAll()
        do {
            try await validateAvailableMediaIdentity()
        } catch is CancellationError {
            endPreparedTimelineEdit()
            markCurrentLongOperationCanceled()
            errorMessage = nil
            statusMessage = "Export canceled"
            return
        } catch {
            // The current AVAsset may lazily read the path after it has been
            // overwritten. Do not leave rejected bytes reachable by playback.
            pausePlayback()
            player.replaceCurrentItem(with: nil)
            builtProject = nil
            renderedFraming.record([])
            await restoreEditState(rollback, rebuildPlayer: false, preserving: error)
        }
    }

    var duration: Double { project.duration }

    /// Keeps the playhead inside the timeline whenever the project changes
    /// under it. An edit that shortens the video must never leave the cursor
    /// past its end.
    private func refreshPlaybackCursor() {
        captionCueCache.refresh(for: project)
        transcriptFlowCache.refresh(for: project)
        // A file the project no longer holds has no business still asking to
        // be located.
        mediaAvailability.refreshIfSubjectsChanged()
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
        toggling: Bool = false,
        ranging: Bool = false
    ) {
        if ranging, let run = selectionRun(to: item) {
            timelineSelection.formUnion(run)
        } else if toggling {
            if timelineSelection.contains(item) {
                timelineSelection.remove(item)
            } else {
                timelineSelection.insert(item)
            }
            selectionAnchor = item
        } else if additive || ranging {
            // Shift with nothing to reach back to adds, which is what it did
            // before ranging existed.
            timelineSelection.insert(item)
            selectionAnchor = item
        } else {
            timelineSelection = [item]
            selectionAnchor = item
        }
        syncInspectorSelection(preferred: timelineSelection.contains(item) ? item : nil)
    }

    /// Everything of one kind between the last thing clicked and this one, which
    /// is what shift-click means everywhere else. Nil when there is nothing of
    /// this kind to reach back to.
    private func selectionRun(to item: TimelineSelectionItem) -> Set<TimelineSelectionItem>? {
        guard let anchor = selectionAnchor, anchor.isSameKind(as: item), anchor != item else {
            return nil
        }
        let ordered = timelineItems(likeKindOf: item)
        guard
            let from = ordered.firstIndex(of: anchor),
            let to = ordered.firstIndex(of: item)
        else { return nil }
        return Set(ordered[min(from, to) ... max(from, to)])
    }

    /// Every item of one kind, in the order they play. The order a run is read
    /// in, so a shift-click covers what the eye covers.
    private func timelineItems(likeKindOf item: TimelineSelectionItem) -> [TimelineSelectionItem] {
        let items: [TimelineSelectionItem] = switch item {
        case .clip: project.clips.map { .clip($0.id) }
        case .caption: captionCues.map { .caption($0.id) }
        case .overlay: overlays.map { .overlay($0.id) }
        case .text: (project.textLayers ?? []).map { .text($0.id) }
        case .audio: (project.audioLayers ?? []).map { .audio($0.id) }
        }
        // Clips are already in playing order and carry no span of their own
        // until they are laid end to end, so they are left as they are.
        if case .clip = item { return items }
        return items.sorted { timelineSelectionOrder($0, $1) }
    }

    /// - Parameter live: true while a marquee is still being dragged. The
    ///   selection itself is published, because the cells have to show what is
    ///   caught, and nothing else is: working out which item the inspector
    ///   should follow means sorting the whole selection, and republishing the
    ///   five selection properties behind it relaid every panel in the editor
    ///   out on every pointer move. `settleTimelineSelection()` does that once,
    ///   when the band is let go.
    func setTimelineSelection(_ selection: Set<TimelineSelectionItem>, live: Bool = false) {
        guard selection != timelineSelection else { return }
        timelineSelection = selection
        guard !live else { return }
        settleTimelineSelection()
    }

    /// Brings the inspector into line with whatever the timeline has selected.
    func settleTimelineSelection() {
        syncInspectorSelection(preferred: timelineSelection.sorted(by: timelineSelectionOrder).last)
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

    var draggedClipIDs: Set<UUID> { selectedClipIDs }

    /// The main-track clips the timeline has selected. A change made to one of
    /// them through the inspector or the canvas lands on all of them: picking
    /// out twenty clips and framing them one at a time is not an edit anybody
    /// makes on purpose.
    var selectedClipIDs: Set<UUID> {
        Set(timelineSelection.compactMap { item -> UUID? in
            if case let .clip(id) = item { return id }
            return nil
        })
    }

    /// The text layers the timeline has selected.
    var selectedTextLayerIDs: Set<UUID> {
        Set(timelineSelection.compactMap { item -> UUID? in
            if case let .text(id) = item { return id }
            return nil
        })
    }

    /// The cutaways the timeline has selected, for the same reason.
    var selectedOverlayIDs: Set<UUID> {
        Set(timelineSelection.compactMap { item -> UUID? in
            if case let .overlay(id) = item { return id }
            return nil
        })
    }

    func commitTimelineSelectionMove() async {
        let delta = timelineSelectionDragDelta
        let committedPlan = timelineReorderPlan ?? reorderPlan(for: delta)
        timelineDrag.clear()
        guard abs(delta) > 0.000_001, !timelineSelection.isEmpty else { return }
        await commitTimelineEdit {
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
            return true
        }
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
        case let .caption(id): wasAlreadySelected = selectedCaptionIDs == captionIDsSelectedOnTimeline(including: id)
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
            // A marquee across the caption track selects a run of cards. The
            // panel used to hear about one of them, so it reported "1 caption"
            // and a restyle or a drag landed on that one alone.
            setSelectedCaptionIDs(captionIDsSelectedOnTimeline(including: id))
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

    /// Every card the timeline has selected, the one the inspector is opening
    /// for included.
    private func captionIDsSelectedOnTimeline(including id: UUID) -> Set<UUID> {
        var ids: Set<UUID> = [id]
        for item in timelineSelection {
            if case let .caption(captionID) = item { ids.insert(captionID) }
        }
        return ids
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
        await commitTimelineEdit(successStatus: "Frame set to \(aspectRatio.title)") {
            project.aspectRatio = aspectRatio
            return true
        }
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

    /// Everything a drag can settle onto.
    ///
    /// - Parameter moving: the items being carried, whose own edges are left
    ///   out. An item is always exactly on its own edge, so leaving them in
    ///   pinned every drag to where it started: the cell would not move at all
    ///   until the pointer had cleared the snap threshold, which reads as a
    ///   stuck timeline rather than as snapping.
    /// The anchors for a drag carrying `item`, and everything selected with it
    /// when it is part of the selection.
    func timelineSnapAnchors(carrying item: TimelineSelectionItem) -> [TimelineSnapAnchor] {
        var moving: Set<UUID> = [item.id]
        if timelineSelection.contains(item) {
            moving.formUnion(timelineSelection.map(\.id))
        }
        return timelineSnapAnchors(moving: moving)
    }

    func timelineSnapAnchors(moving: Set<UUID> = []) -> [TimelineSnapAnchor] {
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
        for layer in project.textLayers ?? [] where !moving.contains(layer.id) {
            anchors.append(TimelineSnapAnchor(time: layer.timelineStart, kind: .boundary))
            anchors.append(TimelineSnapAnchor(time: layer.timelineStart + layer.duration, kind: .boundary))
        }
        for overlay in project.overlays ?? [] where !moving.contains(overlay.id) {
            anchors.append(TimelineSnapAnchor(time: overlay.timelineStart, kind: .boundary))
            anchors.append(TimelineSnapAnchor(time: overlay.timelineStart + overlay.duration, kind: .boundary))
        }
        for layer in project.audioLayers ?? [] where !moving.contains(layer.id) {
            anchors.append(TimelineSnapAnchor(time: layer.timelineStart, kind: .audio))
            anchors.append(TimelineSnapAnchor(time: layer.timelineStart + layer.duration, kind: .audio))
        }
        // A cutaway lines up with what is being said as often as with anything
        // else. Held to a tighter radius than the rest: see TimelineSnapKind.
        for cue in captionCues where !moving.contains(cue.id) {
            anchors.append(TimelineSnapAnchor(time: cue.timelineStart, kind: .card))
            anchors.append(TimelineSnapAnchor(time: cue.timelineEnd, kind: .card))
        }
        for second in 0 ... Int(ceil(duration)) {
            anchors.append(TimelineSnapAnchor(time: min(duration, Double(second)), kind: .second))
        }
        return anchors
    }

    func importMedia(_ urls: [URL]) async {
        guard !urls.isEmpty else { return }
        guard let operation = beginLongOperation(.importingMedia) else { return }
        defer { endLongOperation(operation) }
        await restorationTask?.value
        guard let rollbackState = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        errorMessage = nil
        statusMessage = "Reading media…"

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
            try await persist()
            await reconcileDerivedMedia(from: rollbackState.project)
            recordHistory(before: rollbackState.project)
            statusMessage = landedInBin.isEmpty
                ? "Ready"
                : "\(landedInBin.joined(separator: ", ")) added to Media · use Overlay, Add, or @ it"
        } catch {
            await restoreEditState(rollbackState, rebuildPlayer: true, preserving: error)
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
        let ranges = TranscriptWordSelection.sourceRanges(
            for: keptIDs,
            in: project.transcript ?? []
        )
        await commitTimelineEdit {
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
            return true
        }
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
        await commitTimelineEdit {
            for range in ranges {
                let duration = project.media.first(where: { $0.id == range.mediaID })?.duration ?? .greatestFiniteMagnitude
                project.restoreSourceRange(
                    (range.start, min(duration, range.end)),
                    for: range.mediaID
                )
            }
            // The restored line goes back on screen with a caption under it.
            project.captionRestoredWords()
            currentTime = project.nearestTimelineTime(for: firstWord)
            selectedClipID = project.clip(at: currentTime).map { project.clips[$0.index].id }
            return true
        }
        seek(to: currentTime, exact: true, playAfter: false)
    }

    func deleteTranscriptPause(mediaID: UUID, start: Double, end: Double) async {
        guard end - start >= 0.02,
              project.isSourceRangeKept(mediaID: mediaID, start: start, end: end)
        else { return }
        await commitTimelineEdit {
            project.removeSourceRanges([(start, end)], for: mediaID)
            currentTime = min(currentTime, project.duration)
            selectedClipID = project.clip(at: currentTime).map { project.clips[$0.index].id }
            return true
        }
    }

    func restoreTranscriptPause(mediaID: UUID, start: Double, end: Double) async {
        guard end - start >= 0.02,
              !project.isSourceRangeKept(mediaID: mediaID, start: start, end: end)
        else { return }
        let marker = TranscriptWord(mediaID: mediaID, text: "", start: start, end: end)
        await commitTimelineEdit {
            project.restoreSourceRange((start, end), for: mediaID)
            project.captionRestoredWords()
            currentTime = project.nearestTimelineTime(for: marker)
            selectedClipID = project.clip(at: currentTime).map { project.clips[$0.index].id }
            return true
        }
        seek(to: currentTime, exact: true, playAfter: false)
    }

    func splitAtPlayhead() async {
        let selection = commandTimelineSelection()
        await commitTimelineEdit {
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
                    builtInID: layer.builtInID,
                    sourceKind: layer.sourceKind,
                    sourceFingerprint: layer.sourceFingerprint,
                    savedAudioID: layer.savedAudioID,
                    savedAudioHash: layer.savedAudioHash
                )
                project.audioLayers?.replaceSubrange(index ... index, with: [left, right])
                resultingSelection.insert(.audio(right.id))
                didSplit = true
            }
        }
            guard didSplit else { return false }
            setTimelineSelection(resultingSelection)
            return true
        }
    }

    func deleteSelected() async {
        await deleteTimelineSelection()
    }

    @discardableResult
    /// What Delete acts on: what is actually picked, and nothing else.
    ///
    /// Trimming and splitting aim at the playhead, and asking those to work on
    /// the clip it sits in is what a creator means. Delete is not like that.
    /// The Delete button is disabled with nothing selected, and the key has to
    /// mean the same thing, because falling through to the clip under the
    /// playhead removes something nobody pointed at. Paired with a repeated
    /// delivery of one Backspace, that is what deleted a clip and then the clip
    /// after it.
    private func deletableSelection() -> Set<TimelineSelectionItem> {
        if !timelineSelection.isEmpty { return timelineSelection }
        if let selectedClipID { return [.clip(selectedClipID)] }
        return []
    }

    func deleteTimelineSelection(successStatus: String = "Ready") async -> Bool {
        let selection = deletableSelection()
        guard !selection.isEmpty else { return false }
        let clipIDs = Set(selection.compactMap { if case let .clip(id) = $0 { id } else { nil } })
        let textIDs = Set(selection.compactMap { if case let .text(id) = $0 { id } else { nil } })
        let overlayIDs = Set(selection.compactMap { if case let .overlay(id) = $0 { id } else { nil } })
        let audioIDs = Set(selection.compactMap { if case let .audio(id) = $0 { id } else { nil } })
        return await commitTimelineEdit(successStatus: successStatus) {
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
            return true
        }
    }

    func trimTimelineSelection(toPlayhead edge: TimelineEditEdge) async {
        let selection = commandTimelineSelection()
        guard !selection.isEmpty else { return }
        let originalClipStarts = Dictionary(uniqueKeysWithValues: project.clips.compactMap { clip in
            project.timelineStart(for: clip.id).map { (clip.id, $0) }
        })
        await commitTimelineEdit {
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
            guard changed else { return false }
            if edge == .leading, let leadingClipBoundary { currentTime = leadingClipBoundary }
            currentTime = min(currentTime, project.duration)
            return true
        }
    }

    private func commandTimelineSelection() -> Set<TimelineSelectionItem> {
        if !timelineSelection.isEmpty { return timelineSelection }
        if let hit = project.clip(at: currentTime) {
            return [.clip(project.clips[hit.index].id)]
        }
        if let selectedClipID { return [.clip(selectedClipID)] }
        return []
    }

    @discardableResult
    func export(to url: URL) async -> Bool {
        guard !project.clips.isEmpty else { return false }
        return await runTrackedLongOperation(.exporting) { [weak self] operation in
            await self?.performExport(to: url, owner: operation)
        }
    }

    private func performExport(to url: URL, owner _: LongOperationLease) async {
        guard await beginPreparedTimelineEdit() != nil else { return }
        guard !Task.isCancelled else {
            endPreparedTimelineEdit()
            markCurrentLongOperationCanceled()
            statusMessage = "Export canceled"
            return
        }
        repairBuiltInAudioURLs()
        mediaAvailability.refresh(notifyRestored: false)
        guard mediaAvailability.requiredOffline.isEmpty else {
            endPreparedTimelineEdit()
            errorMessage = "Reconnect the required offline media before exporting."
            return
        }
        do {
            try await validateAvailableMediaIdentity()
        } catch {
            mediaAvailability.refresh(notifyRestored: false)
            endPreparedTimelineEdit()
            show(error)
            return
        }
        let exportProject = project
        endPreparedTimelineEdit()
        errorMessage = nil
        statusMessage = "Exporting native composition…"
        do {
            try await exportRunner(exportProject, url)
            statusMessage = "Exported \(url.lastPathComponent) with audio verified"
            NSWorkspace.shared.activateFileViewerSelecting([url])
        } catch is CancellationError {
            markCurrentLongOperationCanceled()
            errorMessage = nil
            statusMessage = "Export canceled"
        } catch {
            show(error)
        }
    }

    func select(_ clipID: UUID) {
        selectTimelineItem(.clip(clipID))
    }

    func referencesSavedAudio(_ item: SavedAudio, at url: URL) -> Bool {
        let canonical = url.resolvingSymlinksInPath()
        let current = project.audioLayers?.contains(where: {
            $0.savedAudioID == item.id ||
                $0.savedAudioHash == item.contentHash ||
                $0.url.resolvingSymlinksInPath() == canonical
        }) == true
        return current || history.referencesSavedAudio(item, url: canonical)
    }

    func commitClipTrim(_ updated: TimelineClip) async {
        await commitTimelineEdit {
            guard let index = project.clips.firstIndex(where: { $0.id == updated.id }) else { return false }
            project.clips[index] = updated
            selectedClipID = updated.id
            timelineSelection = [.clip(updated.id)]
            currentTime = min(currentTime, project.duration)
            return true
        }
    }

    /// How long a picture holds on the timeline when it is first added.
    static let imageClipDefaultDuration: Double = 4

    func appendMediaToTimeline(_ mediaID: UUID) async {
        guard let media = project.media.first(where: { $0.id == mediaID }) else { return }
        await commitTimelineEdit {
            // A still has no duration of its own, so it gets the same default
            // hold an image overlay gets and is trimmed from there like any
            // other clip.
            let length = media.isImage ? Self.imageClipDefaultDuration : media.duration
            project.clips.append(TimelineClip(
                mediaID: media.id,
                sourceStart: 0,
                sourceEnd: length
            ))
            selectedClipID = project.clips.last?.id
            return true
        }
    }

    func resetMediaToSource(_ mediaID: UUID) async {
        guard let media = project.media.first(where: { $0.id == mediaID }), !media.isImage else { return }
        await commitTimelineEdit(successStatus: "Reset \(media.name) to its full source · ⌘Z to undo") {
            guard let replacement = project.resetMainTrack(
                mediaID: mediaID,
                sourceDuration: media.duration
            ) else { return false }
            selectedClipID = replacement.id
            timelineSelection = [.clip(replacement.id)]
            currentTime = project.timelineStart(for: replacement.id) ?? 0
            return true
        }
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
        var removed: [String] = []
        let success = await commitTimelineEdit(
            successStatus: "Removed \(removed.count == 1 ? removed[0] : "\(removed.count) files") from this project · \(removed.count == 1 ? "source file kept" : "source files kept") · ⌘Z to undo"
        ) {
            for media in doomed {
                guard project.removeImportedMedia(media.id) else { continue }
                removed.append(media.name)
            }
            guard !removed.isEmpty else { return false }
            mediaSelection = mediaSelection.reconciled(against: project.media.map(\.id))
            reconcileSelectionAfterProjectChange()
            currentTime = min(currentTime, project.duration)
            return true
        }
        guard success else { return }
    }

    func addOverlay(_ mediaID: UUID) async {
        guard
            duration > 0,
            let media = project.media.first(where: { $0.id == mediaID })
        else { return }
        let start = min(currentTime, max(0, duration - 0.1))
        let available = max(0.1, duration - start)
        let overlayDuration = min(available, media.isImage ? Self.imageClipDefaultDuration : media.duration)
        let overlay = introducedOverlay(
            media: media,
            timelineStart: start,
            duration: overlayDuration
        )
        await commitTimelineEdit {
            project.overlays = (project.overlays ?? []) + [overlay]
            selectTimelineItem(.overlay(overlay.id))
            inspectorRequest = EditorInspectorRequest(tool: "Overlays")
            return true
        }
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
        var laneNumber = 1
        await commitTimelineEdit(
            successStatus: "Lifted to overlay lane \(laneNumber) · ⌘Z to undo"
        ) {
            guard let overlay = project.promoteClipToOverlay(clipID, start: start, lane: lane) else {
                setStatus("A clip has to stay on the video track")
                return false
            }
            laneNumber = overlay.lane + 1
            selectTimelineItem(.overlay(overlay.id))
            return true
        }
    }

    func addTextLayer(asHook: Bool = false) {
        guard duration > 0 else { return }
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
        scheduleVisualCommit { [self] in
            var layers = project.textLayers ?? []
            layers.append(layer)
            project.textLayers = layers
            selectedTextLayerID = layer.id
            timelineSelection = [.text(layer.id)]
            inspectorRequest = EditorInspectorRequest(tool: "Text")
            project.updatedAt = Date()
            return true
        }
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
            let url = try await soundEffectService.fileURL(for: effect)
            await commitTimelineEdit {
                let start = min(currentTime, max(0, duration - 0.02))
                let layer = ProjectAudioLayer(
                    url: url,
                    name: effect.name,
                    timelineStart: start,
                    duration: min(effect.duration, max(0.02, duration - start)),
                    sourceDuration: effect.duration,
                    builtInID: effect.id,
                    sourceKind: .builtIn
                )
                project.audioLayers = (project.audioLayers ?? []) + [layer]
                selectedAudioLayerID = layer.id
                timelineSelection = [.audio(layer.id)]
                inspectorRequest = EditorInspectorRequest(tool: "Audio")
                return true
            }
        } catch {
            show(error)
        }
    }

    /// - Parameter startingAt: where the first sound lands, for a drop that
    ///   named its own moment. The playhead otherwise, which is what the import
    ///   button means.
    func importAudio(_ urls: [URL], startingAt: Double? = nil) async {
        guard duration > 0, !urls.isEmpty else { return }
        guard let operation = beginLongOperation(.importingAudio) else { return }
        defer { endLongOperation(operation) }
        do {
            var sources: [(URL, Double, String)] = []
            for rawURL in urls {
                let url = rawURL.resolvingSymlinksInPath()
                let sourceDuration = try await soundEffectService.duration(of: url)
                let fingerprint = try await MediaSourceFingerprint.compute(url: url)
                sources.append((url, sourceDuration, fingerprint))
            }
            await commitTimelineEdit(owner: operation) {
                var insertionTime = min(startingAt ?? currentTime, max(0, duration - 0.02))
                var layers = project.audioLayers ?? []
                for (url, sourceDuration, fingerprint) in sources {
                    let layerDuration = min(sourceDuration, max(0.02, duration - insertionTime))
                    guard layerDuration > 0 else { continue }
                    let layer = ProjectAudioLayer(
                        url: url,
                        name: url.deletingPathExtension().lastPathComponent,
                        timelineStart: insertionTime,
                        duration: layerDuration,
                        sourceDuration: sourceDuration,
                        sourceKind: .external,
                        sourceFingerprint: fingerprint
                    )
                    layers.append(layer)
                    selectedAudioLayerID = layer.id
                    insertionTime = min(duration, insertionTime + layerDuration)
                }
                guard layers != project.audioLayers ?? [] else { return false }
                project.audioLayers = layers
                inspectorRequest = EditorInspectorRequest(tool: "Audio")
                return true
            }
        } catch {
            show(error)
        }
    }

    func selectAudioLayer(_ id: UUID) {
        selectTimelineItem(.audio(id))
    }

    func updateAudioLayer(_ updated: ProjectAudioLayer) async {
        await commitTimelineEdit {
            guard let index = project.audioLayers?.firstIndex(where: { $0.id == updated.id }) else { return false }
            project.audioLayers?[index] = updated
            return true
        }
    }

    func deleteSelectedAudioLayer() async {
        guard let selectedAudioLayerID else { return }
        await commitTimelineEdit {
            project.audioLayers?.removeAll { $0.id == selectedAudioLayerID }
            self.selectedAudioLayerID = project.audioLayers?.last?.id
            return true
        }
    }

    func selectOverlay(_ id: UUID) {
        selectTimelineItem(.overlay(id))
    }

    func commitAudioTrim(_ updated: ProjectAudioLayer) async {
        await commitTimelineEdit {
            guard let index = project.audioLayers?.firstIndex(where: { $0.id == updated.id }) else { return false }
            project.audioLayers?[index] = updated
            selectedAudioLayerID = updated.id
            return true
        }
    }

    func selectTextLayer(_ id: UUID) {
        selectTimelineItem(.text(id))
    }

    func updateTextLayer(_ updated: ProjectTextLayer) {
        scheduleVisualCommit { [self] in
            guard let index = project.textLayers?.firstIndex(where: { $0.id == updated.id }) else { return false }
            project.textLayers?[index] = updated
            project.updatedAt = Date()
            return true
        }
    }

    func deleteSelectedTextLayer() {
        guard let selectedTextLayerID else { return }
        scheduleVisualCommit { [self] in
            project.textLayers?.removeAll { $0.id == selectedTextLayerID }
            self.selectedTextLayerID = project.textLayers?.last?.id
            project.updatedAt = Date()
            return true
        }
    }

    func transcribeProject() async {
        if let transcriptionTask {
            await transcriptionTask.value
            return
        }
        lastTranscriptionWasCanceled = false
        let token = UUID()
        let task = Task { [weak self] in
            guard let self else { return }
            await self.performTranscription()
        }
        transcriptionTask = task
        transcriptionToken = token
        await task.value
        if transcriptionToken == token {
            transcriptionTask = nil
            transcriptionToken = nil
        }
    }

    private func performTranscription() async {
        guard !project.clips.isEmpty else { return }
        guard let operation = beginLongOperation(.transcribing) else { return }
        defer { endLongOperation(operation) }
        guard let rollbackState = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        aiProgress = 0
        lastTranscriptionWasCanceled = false
        errorMessage = nil
        do {
            let mediaIDs = Array(Set(project.clips.map(\.mediaID)))
            for (index, mediaID) in mediaIDs.enumerated() {
                try Task.checkCancellation()
                guard let media = project.media.first(where: { $0.id == mediaID }) else { continue }
                statusMessage = "Transcribing \(media.name)…"
                let mediaBase = Double(index) / Double(max(1, mediaIDs.count))
                let mediaShare = 1 / Double(max(1, mediaIDs.count))
                let reportProgress: @MainActor @Sendable (Double) -> Void = { [weak self] fraction in
                    guard let self, self.activeOperation?.operation == .transcribing else { return }
                    self.aiProgress = max(self.aiProgress, mediaBase + mediaShare * fraction)
                }
                let words = try await transcribedWords(of: media, progress: reportProgress)
                var transcript = project.transcript ?? []
                transcript.removeAll { $0.mediaID == mediaID }
                transcript.append(contentsOf: words)
                project.transcript = transcript
                aiProgress = Double(index + 1) / Double(max(1, mediaIDs.count))
            }
            project.updatedAt = Date()
            try await persist()
            recordHistory(before: rollbackState.project)
            statusMessage = "Transcript ready · \(project.timelineTranscript.count) words"
        } catch {
            if error is CancellationError {
                project = rollbackState.project
                aiProgress = 0
                lastTranscriptionWasCanceled = true
                statusMessage = "Transcription canceled"
            } else {
                await restoreEditState(rollbackState, rebuildPlayer: false, preserving: error)
            }
        }
    }

    func startTranscription() {
        guard transcriptionTask == nil, activeOperation == nil else { return }
        lastTranscriptionWasCanceled = false
        let token = UUID()
        transcriptionToken = token
        transcriptionTask = Task { [weak self] in
            await self?.performTranscription()
            if self?.transcriptionToken == token {
                self?.transcriptionTask = nil
                self?.transcriptionToken = nil
            }
        }
    }

    func cancelCurrentTranscription() {
        guard activeOperation?.operation == .transcribing else { return }
        transcriptionTask?.cancel()
    }

    var hasTrackedTranscription: Bool { transcriptionTask != nil }

    func transcribeMissingProjectMediaWithinOperation() async throws {
        for mediaID in Set(project.clips.map(\.mediaID)) {
            guard
                !(project.transcript ?? []).contains(where: { $0.mediaID == mediaID }),
                let media = project.media.first(where: { $0.id == mediaID })
            else { continue }
            let words = try await aiEditService.transcribe(media: media, dictionary: dictionaryEntries)
            updateProject { project in
                var transcript = project.transcript ?? []
                transcript.removeAll { $0.mediaID == mediaID }
                transcript.append(contentsOf: words)
                project.transcript = transcript
            }
        }
    }

    @discardableResult
    func runOneClickEdit() async -> Bool {
        guard !project.clips.isEmpty else { return false }
        return await runTrackedLongOperation(.oneClickEdit) { [weak self] operation in
            await self?.performOneClickEdit(owner: operation)
        }
    }

    private func performOneClickEdit(owner _: LongOperationLease) async {
        guard !Task.isCancelled else {
            markCurrentLongOperationCanceled()
            statusMessage = "1-Click Edit canceled"
            return
        }
        guard let rollbackState = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        let original = rollbackState.project
        aiProgress = 0
        oneClickEditStage = .preparing
        errorMessage = nil
        defer {
            oneClickEditStage = nil
        }

        // Transcribing is the slow, paid half of this. Whatever it hears is
        // kept even when the edit that follows fails, so a retry is a retry of
        // the part that broke rather than another two minutes and another
        // credit spent hearing the same words again.
        var heard: [TranscriptWord]?
        do {
            let mediaIDs = Array(Set(project.clips.map(\.mediaID)))
            for (index, mediaID) in mediaIDs.enumerated() {
                try Task.checkCancellation()
                guard let media = project.media.first(where: { $0.id == mediaID }) else { continue }
                var words = (project.transcript ?? []).filter { $0.mediaID == mediaID }
                if words.isEmpty {
                    setOneClickEditStage(.transcribing)
                    words = try await transcribedWords(of: media)
                    var transcript = project.transcript ?? []
                    transcript.removeAll { $0.mediaID == mediaID }
                    transcript.append(contentsOf: words)
                    project.transcript = transcript
                    heard = transcript
                }
                guard !words.isEmpty else {
                    throw NativeEditorError.aiFailed("No spoken words were found in \(media.name).")
                }

                setOneClickEditStage(.removingRetakes)
                // The silence pass needs this take read end to end and the
                // model does not, so the reading runs alongside the thinking
                // instead of behind it.
                let loudness = Task.detached { [service = aiEditService, url = media.url] in
                    await service.warmEnvelope(url: url)
                }
                defer { loudness.cancel() }
                let cuts = try await aiEditService.cleanCuts(words: words)
                setOneClickEditStage(.cuttingPauses)
                await loudness.value
                let ranges = try await aiEditService.autoEditRanges(
                    words: words,
                    duration: media.duration,
                    aiCuts: cuts,
                    url: media.url
                )
                try Task.checkCancellation()
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
            try Task.checkCancellation()
            try await rebuildComposition(preserveTime: false)
            try Task.checkCancellation()
            try await persist()
            recordHistory(before: original)
            statusMessage = "1-Click Edit + captions complete · \(project.clips.count) clips"
        } catch is CancellationError {
            markCurrentLongOperationCanceled()
            await restoreCanceledEditState(
                rollbackState,
                rebuildPlayer: true,
                status: "1-Click Edit canceled"
            )
        } catch {
            await restoreEditState(rollbackState, rebuildPlayer: true, preserving: error)
            await keepTranscript(heard)
        }
    }

    /// What the progress overlay paces itself by: how much there is to read and
    /// how long the take runs.
    var oneClickEditPace: OneClickEditPace {
        OneClickEditPace(
            words: (project.transcript ?? []).count,
            mediaSeconds: project.media.first?.duration ?? 0
        )
    }

    /// One way to get a take's words, whoever is asking.
    ///
    /// The one-click edit used to call the transcriber directly while the
    /// standalone Transcribe went through the injected runner, so the slowest
    /// and most expensive path in the app was the one no test could reach.
    private func transcribedWords(
        of media: ProjectMedia,
        progress: (@MainActor @Sendable (Double) -> Void)? = nil
    ) async throws -> [TranscriptWord] {
        if let transcriptionRunner {
            return try await transcriptionRunner(media, dictionaryEntries, progress)
        }
        return try await aiEditService.transcribe(
            media: media,
            dictionary: dictionaryEntries,
            progress: progress
        )
    }

    /// Puts back what the transcriber heard after a failed edit rolled the
    /// project away from it. Only the words: the timeline the creator had is
    /// the one they get back.
    private func keepTranscript(_ heard: [TranscriptWord]?) async {
        guard let heard, !heard.isEmpty, (project.transcript ?? []).isEmpty else { return }
        project.transcript = heard
        try? await persist()
    }

    /// The Captions on/off switch. Turning them off keeps the cards so the
    /// creator's text edits and restyling survive turning them back on.
    @discardableResult
    func toggleCaptions() async -> Bool {
        guard !project.clips.isEmpty else { return false }
        if activeOperation?.operation == .captions {
            return await withCheckedContinuation { captionOperationWaiters.append($0) }
        }
        return await runTrackedLongOperation(.captions) { [weak self] operation in
            await self?.performCaptionToggle(owner: operation)
        }
    }

    private func performCaptionToggle(owner _: LongOperationLease) async {
        guard let rollbackState = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        do {
            try Task.checkCancellation()
            let successStatus: String
            if project.captionsEnabled == true {
                project.setCaptionsVisible(false)
                let count = project.storedCaptions.count
                successStatus = "Captions hidden · \(count) card\(count == 1 ? "" : "s") kept"
            } else if !project.storedCaptions.isEmpty {
                project.setCaptionsVisible(true)
                let count = project.captionEntries.count
                successStatus = "Captions shown · \(count) card\(count == 1 ? "" : "s")"
            } else {
                errorMessage = nil
                let mediaIDs = Array(Set(project.clips.map(\.mediaID)))
                for mediaID in mediaIDs {
                    try Task.checkCancellation()
                    guard
                        !(project.transcript ?? []).contains(where: { $0.mediaID == mediaID }),
                        let media = project.media.first(where: { $0.id == mediaID })
                    else { continue }
                    statusMessage = "Transcribing before adding captions…"
                    let words = try await aiEditService.transcribe(
                        media: media,
                        dictionary: dictionaryEntries
                    )
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
                let count = project.captionEntries.count
                successStatus = "Captions ready · \(count) card\(count == 1 ? "" : "s")"
            }
            try Task.checkCancellation()
            _ = await commitPreparedTimelineEdit(
                rollbackState: rollbackState,
                requiresRebuild: false,
                successStatus: successStatus
            )
        } catch is CancellationError {
            markCurrentLongOperationCanceled()
            await restoreCanceledEditState(
                rollbackState,
                rebuildPlayer: false,
                status: "Caption update canceled"
            )
        } catch {
            await restoreEditState(rollbackState, rebuildPlayer: false, preserving: error)
        }
    }

    /// Rebuilds every card from the current transcript and cut, transcribing
    /// first if the project has never been listened to. Regeneration is always
    /// explicit, so hand-edited text is never silently thrown away.
    @discardableResult
    func generateCaptions() async -> Bool {
        guard !project.clips.isEmpty else { return false }
        return await runTrackedLongOperation(.captions) { [weak self] operation in
            await self?.performCaptionGeneration(owner: operation)
        }
    }

    private func performCaptionGeneration(owner _: LongOperationLease) async {
        guard !Task.isCancelled else {
            markCurrentLongOperationCanceled()
            statusMessage = "Caption generation canceled"
            return
        }
        guard let rollbackState = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        errorMessage = nil
        defer {
        }
        do {
            let mediaIDs = Array(Set(project.clips.map(\.mediaID)))
            for mediaID in mediaIDs {
                try Task.checkCancellation()
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
            try Task.checkCancellation()
            try await persist()
            recordHistory(before: rollbackState.project)
            let count = project.captionEntries.count
            statusMessage = "Captions ready · \(count) card\(count == 1 ? "" : "s")"
        } catch is CancellationError {
            markCurrentLongOperationCanceled()
            await restoreCanceledEditState(
                rollbackState,
                rebuildPlayer: false,
                status: "Caption generation canceled"
            )
        } catch {
            await restoreEditState(rollbackState, rebuildPlayer: false, preserving: error)
        }
    }

    @discardableResult
    func autoTrimSilences() async -> Bool {
        guard !project.clips.isEmpty else { return false }
        return await runTrackedLongOperation(.autoTrim) { [weak self] operation in
            await self?.performAutoTrim(owner: operation)
        }
    }

    private func performAutoTrim(owner _: LongOperationLease) async {
        guard !Task.isCancelled else {
            markCurrentLongOperationCanceled()
            statusMessage = "Auto-trim canceled"
            return
        }
        guard let rollbackState = await beginPreparedTimelineEdit() else { return }
        defer { endPreparedTimelineEdit() }
        let original = rollbackState.project
        aiProgress = 0
        errorMessage = nil
        defer {
        }
        do {
            let mediaIDs = Array(Set(project.clips.map(\.mediaID)))
            for (index, mediaID) in mediaIDs.enumerated() {
                try Task.checkCancellation()
                guard let media = project.media.first(where: { $0.id == mediaID }) else { continue }
                var words = (project.transcript ?? []).filter { $0.mediaID == mediaID }
                if words.isEmpty {
                    statusMessage = "Transcribing before auto-trim…"
                    words = try await transcribedWords(of: media)
                    var transcript = project.transcript ?? []
                    transcript.removeAll { $0.mediaID == mediaID }
                    transcript.append(contentsOf: words)
                    project.transcript = transcript
                }
                guard !words.isEmpty else { continue }
                statusMessage = "Trimming silent gaps…"
                let ranges = try await aiEditService.silenceRanges(
                    words: words,
                    duration: media.duration,
                    url: media.url
                )
                try Task.checkCancellation()
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
            try Task.checkCancellation()
            try await rebuildComposition(preserveTime: false)
            try Task.checkCancellation()
            try await persist()
            recordHistory(before: original)
            statusMessage = "Auto-trim complete · \(project.clips.count) clips"
        } catch is CancellationError {
            markCurrentLongOperationCanceled()
            await restoreCanceledEditState(
                rollbackState,
                rebuildPlayer: true,
                status: "Auto-trim canceled"
            )
        } catch {
            await restoreEditState(rollbackState, rebuildPlayer: true, preserving: error)
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
        await acquireEditCommitSlot()
        defer { releaseEditCommitSlot() }
        guard await flushPendingEdit() else { return }
        let rollbackState = captureRollbackState()
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
            try await persist()
            await reconcileDerivedMedia(from: current)
            statusMessage = direction == .undo ? "Undo" : "Redo"
        } catch {
            switch direction {
            case .undo:
                _ = history.redo(current: target)
            case .redo:
                _ = history.undo(current: target)
            }
            await restoreEditState(rollbackState, rebuildPlayer: true, preserving: error)
        }
        syncHistoryAvailability()
    }

    /// Runs a timeline mutation only after every earlier edit has settled. The
    /// mutation lives inside this boundary so a save failure always owns the
    /// exact model, player and selection state that existed before it began.
    @discardableResult
    func commitTimelineEdit(
        requiresRebuild: Bool = true,
        successStatus: @autoclosure () -> String = "Ready",
        owner: LongOperationLease? = nil,
        _ mutation: () -> Bool
    ) async -> Bool {
        guard activeOperation == nil || activeOperation?.token == owner?.token else { return false }
        await acquireEditCommitSlot()
        defer { releaseEditCommitSlot() }

        guard await flushPendingEdit() else { return false }
        let rollback = captureRollbackState()
        guard mutation() else {
            restoreEditStateWithoutRebuild(rollback)
            return false
        }
        project.updatedAt = Date()
        do {
            if requiresRebuild {
                try await rebuildComposition(preserveTime: true)
            }
            try await persist()
            await reconcileDerivedMedia(from: rollback.project)
            recordHistory(before: rollback.project)
            statusMessage = successStatus()
            return true
        } catch {
            await restoreEditState(rollback, rebuildPlayer: requiresRebuild, preserving: error)
            return false
        }
    }

    /// Temporary bridge for the media/AI transaction PR. These callers mutate
    /// across asynchronous probing and cannot safely move into the synchronous
    /// mutation boundary until their work is staged first.
    @discardableResult
    func commitPreparedTimelineEdit(
        rollbackState: RebuiltProjectRollbackState,
        requiresRebuild: Bool = true,
        successStatus: String = "Ready"
    ) async -> Bool {
        project.updatedAt = Date()
        do {
            if requiresRebuild {
                try await rebuildComposition(preserveTime: true)
            }
            try await persist()
            await reconcileDerivedMedia(from: rollbackState.project)
            recordHistory(before: rollbackState.project)
            statusMessage = successStatus
            return true
        } catch {
            await restoreEditState(
                rollbackState,
                rebuildPlayer: requiresRebuild,
                preserving: error
            )
            return false
        }
    }

    /// Holds the editor across an excluded async preparation/mutation path.
    /// The media transaction PR will replace this bridge with staged mutations;
    /// until then it prevents those paths from racing a pending gesture.
    func beginPreparedTimelineEdit() async -> RebuiltProjectRollbackState? {
        await acquireEditCommitSlot()
        guard await flushPendingEdit() else {
            releaseEditCommitSlot()
            return nil
        }
        return captureRollbackState()
    }

    func endPreparedTimelineEdit() {
        releaseEditCommitSlot()
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

    func scheduleVisualCommit(
        successStatus: String = "Ready",
        _ mutation: @escaping @MainActor () -> Bool
    ) {
        scheduleEdit(
            requiresRebuild: false,
            settleFor: .milliseconds(140),
            successStatus: successStatus,
            mutation
        )
    }

    /// Like `scheduleVisualCommit`, for edits the composition itself has to be
    /// rebuilt for: a video cutaway moving, or being resized. Rebuilding on
    /// every step of a gesture would stutter, so the last one wins and the
    /// whole gesture lands as a single undo step.
    func scheduleCompositionCommit(
        settleFor delay: Duration = .milliseconds(220),
        successStatus: String = "Ready",
        _ mutation: @escaping @MainActor () -> Bool
    ) {
        scheduleEdit(
            requiresRebuild: true,
            settleFor: delay,
            successStatus: successStatus,
            mutation
        )
    }

    /// A queued toggle has to derive both its state and its message when it
    /// actually executes. Two clicks made while another save is in flight must
    /// cancel each other, not both replay the same pre-wait value.
    func scheduleCompositionCommitResolvingStatus(
        settleFor delay: Duration = .milliseconds(220),
        _ mutation: @escaping @MainActor () -> String?
    ) {
        scheduleEdit(
            requiresRebuild: true,
            settleFor: delay,
            mutation
        )
    }

    private struct PendingEdit {
        let rollback: RebuiltProjectRollbackState
        var revision: Int
        var requiresRebuild: Bool
        var successStatus: String
    }

    private struct ScheduledEdit {
        let requiresRebuild: Bool
        let delay: Duration
        let mutation: @MainActor () -> String?
    }

    private func scheduleEdit(
        requiresRebuild: Bool,
        settleFor delay: Duration,
        successStatus: String,
        _ mutation: @escaping @MainActor () -> Bool
    ) {
        guard activeOperation == nil else { return }
        let edit = ScheduledEdit(
            requiresRebuild: requiresRebuild,
            delay: delay,
            mutation: { mutation() ? successStatus : nil }
        )
        guard !editCommitInFlight else {
            queuedScheduledEdits.append(edit)
            return
        }
        applyScheduledEdit(edit)
    }

    private func scheduleEdit(
        requiresRebuild: Bool,
        settleFor delay: Duration,
        _ mutation: @escaping @MainActor () -> String?
    ) {
        guard activeOperation == nil else { return }
        let edit = ScheduledEdit(
            requiresRebuild: requiresRebuild,
            delay: delay,
            mutation: mutation
        )
        guard !editCommitInFlight else {
            queuedScheduledEdits.append(edit)
            return
        }
        applyScheduledEdit(edit)
    }

    private func applyScheduledEdit(_ edit: ScheduledEdit) {
        let mutationRollback = captureRollbackState()
        let rollback = pendingEdit?.rollback ?? mutationRollback
        guard let successStatus = edit.mutation() else {
            restoreEditStateWithoutRebuild(mutationRollback)
            return
        }

        nextEditRevision += 1
        let revision = nextEditRevision
        if var pendingEdit {
            pendingEdit.revision = revision
            pendingEdit.requiresRebuild = pendingEdit.requiresRebuild || edit.requiresRebuild
            pendingEdit.successStatus = successStatus
            self.pendingEdit = pendingEdit
        } else {
            pendingEdit = PendingEdit(
                rollback: rollback,
                revision: revision,
                requiresRebuild: edit.requiresRebuild,
                successStatus: successStatus
            )
        }

        editCommitTask?.cancel()
        editCommitTask = Task { [weak self] in
            do {
                try await Task.sleep(for: edit.delay)
                guard !Task.isCancelled, let self else { return }
                await self.commitScheduledEdit(revision: revision)
            } catch is CancellationError {
                return
            } catch {
                self?.show(error)
            }
        }
    }

    private func commitScheduledEdit(revision: Int) async {
        await acquireEditCommitSlot()
        defer { releaseEditCommitSlot() }
        guard !Task.isCancelled, pendingEdit?.revision == revision else { return }
        _ = await commitPendingEdit(revision: revision)
    }

    /// Commits the coalesced gesture immediately. Immediate edits call this
    /// before capturing their own rollback state, so the two durable boundaries
    /// can never be accidentally folded together.
    private func flushPendingEdit() async -> Bool {
        guard let pendingEdit else { return true }
        editCommitTask?.cancel()
        editCommitTask = nil
        return await commitPendingEdit(revision: pendingEdit.revision)
    }

    /// Makes the latest coalesced canvas gesture durable before macOS allows
    /// the process to terminate. Acquiring the regular edit slot also waits
    /// for an in-flight save and applies gestures queued behind it in their
    /// original order. A storage failure returns false so the app can cancel
    /// termination instead of silently discarding the creator's last edit.
    func prepareForTermination() async -> Bool {
        await acquireEditCommitSlot()
        defer { releaseEditCommitSlot() }
        return await flushPendingEdit()
    }

    private func commitPendingEdit(revision: Int) async -> Bool {
        guard let pending = pendingEdit, pending.revision == revision else { return true }
        do {
            if pending.requiresRebuild {
                try await rebuildComposition(preserveTime: true)
                guard pendingEdit?.revision == revision else { return true }
            }
            try await persist()
            guard pendingEdit?.revision == revision else { return true }
            recordHistory(before: pending.rollback.project)
            statusMessage = pending.successStatus
            pendingEdit = nil
            editCommitTask = nil
            return true
        } catch {
            guard pendingEdit?.revision == revision else { return true }
            pendingEdit = nil
            editCommitTask = nil
            await restoreEditState(
                pending.rollback,
                rebuildPlayer: pending.requiresRebuild,
                preserving: error
            )
            return false
        }
    }

    private func acquireEditCommitSlot() async {
        guard editCommitInFlight else {
            editCommitInFlight = true
            return
        }
        await withCheckedContinuation { continuation in
            editCommitWaiters.append(continuation)
        }
    }

    private func releaseEditCommitSlot() {
        editCommitInFlight = false
        if !queuedScheduledEdits.isEmpty {
            // These gestures happened before any waiter acquired the editor.
            // Apply them first; the resumed immediate edit will flush their
            // pending commit before executing its own mutation.
            let queued = queuedScheduledEdits
            queuedScheduledEdits.removeAll(keepingCapacity: true)
            for edit in queued { applyScheduledEdit(edit) }
        }
        if !editCommitWaiters.isEmpty {
            editCommitInFlight = true
            editCommitWaiters.removeFirst().resume()
        }
    }

    func recordHistory(before snapshot: EditorProject) {
        history.record(before: snapshot, after: project)
        syncHistoryAvailability()
    }

    func rewriteHistoryMedia(_ replacements: [ProjectMedia]) {
        history.rewriteMedia(Dictionary(uniqueKeysWithValues: replacements.map { ($0.id, $0) }))
        syncHistoryAvailability()
    }

    func rewriteHistoryAudio(_ replacement: ProjectAudioLayer) {
        history.rewriteAudio(replacement)
        syncHistoryAvailability()
    }

    func requiredHistoryAudioSourceEnd(_ id: UUID) -> Double {
        history.requiredAudioSourceEnd(for: id)
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
        try await validateAvailableMediaIdentity()
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

    /// Shows an in-flight framing in the composition itself, rather than only as
    /// a transform laid over the whole player.
    ///
    /// The picture the player draws has the video cutaways in it, so pushing
    /// the player view around carried them along: the speaker moved and the
    /// screen recording sitting over them moved too, which is neither what the
    /// edit says nor what exports. Rebuilding the video composition while the
    /// gesture runs moves the one layer that is meant to move. Only the
    /// composition is rebuilt and not the tracks, so the item stays and the
    /// picture never blacks out, and the transform in `FramedPlayerView` covers
    /// the gap from one rebuild to the next.
    func previewFraming(_ framing: VideoFraming, clipID: UUID) {
        pendingFramingPreview = (framing, clipID)
        guard framingPreviewLoop == nil else { return }
        framingPreviewLoop = Task { [weak self] in
            while let self, let next = self.pendingFramingPreview {
                self.pendingFramingPreview = nil
                await self.showFramingPreview(next.framing, clipID: next.clipID)
                // A ceiling on how often the composition is rebuilt: often
                // enough that a cutaway never visibly travels, rarely enough
                // that the drag is not competing with a build for every frame.
                try? await Task.sleep(for: .milliseconds(60))
            }
            self?.framingPreviewLoop = nil
        }
    }

    private func showFramingPreview(_ framing: VideoFraming, clipID: UUID) async {
        guard
            !rebuilding,
            activeOperation == nil,
            let index = project.clips.firstIndex(where: { $0.id == clipID }),
            // A keyed clip is a different picture every frame and the gesture
            // writes a key rather than a framing, so it has nothing to preview.
            !VideoFramingTrack.isKeyed(project.clips[index]),
            let current = player.currentItem,
            let builtProject
        else { return }
        var snapshot = project
        snapshot.clips[index].framing = framing.isIdentity ? nil : framing
        // Only ever the transform: anything else and this is the wrong tool.
        guard builtProject.differsOnlyInPresentation(from: snapshot) else { return }
        rebuilding = true
        defer { rebuilding = false }
        guard
            let built = try? await CompositionBuilder.build(project: snapshot, for: .preview),
            let reframed = built.playbackVideoComposition,
            player.currentItem === current
        else { return }
        current.videoComposition = reframed
        self.builtProject = snapshot
        // What the composition is showing now, which is what the preview
        // transform measures itself against: once it agrees with the gesture,
        // the transform is nothing and the cutaways are back where they belong.
        renderedFraming.record(snapshot.clips)
        if player.timeControlStatus == .paused { refreshPausedFrame() }
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
    func restartDerivedMedia(for media: ProjectMedia) async {
        await invalidateDerivedMedia(media.id)
        await beginDerivedMedia(for: media)
    }

    private func beginDerivedMedia(for media: ProjectMedia) async {
        let generation = derivedGenerationFence.advance(media.id)
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
        thumbnailTasksByMedia[media.id] = Task { [weak self] in
            guard let self else { return }
            do {
                _ = try await thumbnailService.thumbnails(for: media) { [weak self] images in
                    guard let self, self.acceptsDerivedMedia(media, generation: generation) else { return }
                    self.thumbnailsByMedia[media.id] = images
                }
            } catch is CancellationError {
                return
            } catch {
                // The editor is usable without a thumbnail.
            }
        }
        waveformTasksByMedia[media.id] = Task { [weak self] in
            guard let self else { return }
            do {
                _ = try await waveformService.peaks(for: WaveformSource(media: media)) { [weak self] peaks, fraction in
                    guard let self, self.acceptsDerivedMedia(media, generation: generation) else { return }
                    self.waveformByMedia[media.id] = peaks
                    self.waveformProgressByMedia[media.id] = fraction
                }
            } catch is CancellationError {
                return
            } catch {
                guard acceptsDerivedMedia(media, generation: generation) else { return }
                waveformProgressByMedia[media.id] = 1
            }
        }
    }

    private func acceptsDerivedMedia(_ media: ProjectMedia, generation: Int) -> Bool {
        derivedGenerationFence.accepts(media.id, generation: generation) &&
            project.media.first(where: { $0.id == media.id }) == media
    }

    private func invalidateDerivedMedia(_ mediaID: UUID) async {
        _ = derivedGenerationFence.advance(mediaID)
        validatedMediaRevisions.removeValue(forKey: mediaID)
        thumbnailTasksByMedia.removeValue(forKey: mediaID)?.cancel()
        waveformTasksByMedia.removeValue(forKey: mediaID)?.cancel()
        thumbnailsByMedia.removeValue(forKey: mediaID)
        waveformByMedia.removeValue(forKey: mediaID)
        waveformProgressByMedia.removeValue(forKey: mediaID)
        await thumbnailService.invalidate(mediaID: mediaID)
    }

    /// Keeps ephemeral derived data aligned with the project only after the
    /// project transition has crossed its durable save boundary.
    private func reconcileDerivedMedia(from previous: EditorProject) async {
        let before = Dictionary(uniqueKeysWithValues: previous.media.map { ($0.id, $0) })
        let after = Dictionary(uniqueKeysWithValues: project.media.map { ($0.id, $0) })
        for (id, oldMedia) in before where after[id] != oldMedia {
            await invalidateDerivedMedia(id)
        }
        for (id, media) in after where before[id] != media {
            // A changed id was invalidated above; a newly introduced id has no
            // work to cancel but still needs any service-level stale cache gone.
            if before[id] == nil { await invalidateDerivedMedia(id) }
            await beginDerivedMedia(for: media)
        }
        let retainedURLs = Set(project.media.map(\.url) + (project.audioLayers ?? []).map(\.url))
        CompositionSourceCache.shared.keepOnly(retainedURLs)
    }

    func reconcileDerivedMediaAfterDurableChange(from previous: EditorProject) async {
        await reconcileDerivedMedia(from: previous)
    }

    private func restoreProject() async {
        do {
            guard let saved = try await store.load() else { return }
            let recoveryNotice = await store.takeRecoveryNotice()
            history.clear()
            pendingEdit = nil
            syncHistoryAvailability()
            // Restored whole, including anything the editor cannot currently
            // read. This used to drop unreachable media along with its clips,
            // its transcript, its captions and its cutaways, which meant an
            // unplugged card silently deleted the edit made on it: reopening
            // with the card out and saving once made that permanent. A file
            // that is not there right now is a file to reconnect, and every cut
            // made against it is still exactly right. See MediaAvailability.
            project = saved
            repairBuiltInAudioURLs()
            selectedClipID = project.clips.first?.id
            selectedTextLayerID = project.textLayers?.first?.id
            selectedAudioLayerID = project.audioLayers?.first?.id
            selectedOverlayID = project.overlays?.first?.id
            timelineSelection = selectedClipID.map { [.clip($0)] } ?? []
            mediaAvailability.refresh()
            for media in project.media where !offlineMedia.contains(where: { $0.id == media.id }) {
                await beginDerivedMedia(for: media)
            }
            guard mediaAvailability.requiredOffline.isEmpty else {
                statusMessage = recoveryNotice.map { "\($0) · media offline" } ?? "Media offline"
                return
            }
            if !project.clips.isEmpty {
                try await rebuildComposition(preserveTime: false)
                statusMessage = recoveryNotice ?? "Restored \(project.name)"
            } else if let recoveryNotice {
                statusMessage = recoveryNotice
            }
        } catch {
            show(error)
        }
    }

    func persist() async throws {
        try await store.save(project)
    }

    struct RebuiltProjectRollbackState {
        let project: EditorProject
        let currentTime: Double
        let selectedClipID: UUID?
        let selectedTextLayerID: UUID?
        let selectedAudioLayerID: UUID?
        let selectedOverlayID: UUID?
        let selectedCaptionIDs: Set<UUID>
        let timelineSelection: Set<TimelineSelectionItem>
        let mediaSelection: MediaSelection
        let isVideoFrameSelected: Bool
        let cropRequest: CropRequest?
    }

    func captureRollbackState() -> RebuiltProjectRollbackState {
        RebuiltProjectRollbackState(
            project: project,
            currentTime: currentTime,
            selectedClipID: selectedClipID,
            selectedTextLayerID: selectedTextLayerID,
            selectedAudioLayerID: selectedAudioLayerID,
            selectedOverlayID: selectedOverlayID,
            selectedCaptionIDs: selectedCaptionIDs,
            timelineSelection: timelineSelection,
            mediaSelection: mediaSelection,
            isVideoFrameSelected: isVideoFrameSelected,
            cropRequest: cropRequest
        )
    }

    /// A failed save can arrive after the player has already accepted a newly
    /// built composition. Restoring only the model would leave the canvas and
    /// transport playing a different edit, so rollback rebuilds the snapshot
    /// too and then restores the original failure message.
    func restoreEditState(
        _ state: RebuiltProjectRollbackState,
        rebuildPlayer: Bool,
        preserving error: Error
    ) async {
        let failedProject = project
        restoreEditStateWithoutRebuild(state)
        if rebuildPlayer {
            do {
                try await rebuildComposition(preserveTime: true)
            } catch {
                // Never leave the player holding the rejected composition when
                // the durable snapshot itself is currently offline.
                player.replaceCurrentItem(with: nil)
                builtProject = nil
            }
        }
        await reconcileDerivedMedia(from: failedProject)
        show(error)
    }

    /// Cancellation is an expected user action, not an editor failure. Restore
    /// the exact pre-operation model/player state without surfacing a red error.
    func restoreCanceledEditState(
        _ state: RebuiltProjectRollbackState,
        rebuildPlayer: Bool,
        status: String
    ) async {
        // Rollback must outlive the canceled worker. Running it in a fresh task
        // prevents cancellation from immediately aborting the player rebuild.
        let cleanup = Task { @MainActor [weak self] in
            guard let self else { return }
            let failedProject = self.project
            self.restoreEditStateWithoutRebuild(state)
            if rebuildPlayer {
                do {
                    try await self.rebuildComposition(preserveTime: true)
                } catch {
                    self.player.replaceCurrentItem(with: nil)
                    self.builtProject = nil
                }
            }
            await self.reconcileDerivedMedia(from: failedProject)
            self.aiProgress = 0
            self.errorMessage = nil
            self.statusMessage = status
        }
        await cleanup.value
    }

    private func restoreEditStateWithoutRebuild(_ state: RebuiltProjectRollbackState) {
        project = state.project
        selectedClipID = state.selectedClipID
        selectedTextLayerID = state.selectedTextLayerID
        selectedAudioLayerID = state.selectedAudioLayerID
        selectedOverlayID = state.selectedOverlayID
        selectedCaptionIDs = state.selectedCaptionIDs
        timelineSelection = state.timelineSelection
        mediaSelection = state.mediaSelection
        isVideoFrameSelected = state.isVideoFrameSelected
        cropRequest = state.cropRequest
        currentTime = min(state.currentTime, project.duration)
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
        if assistantRunInFlight { cancelCurrentOperation() }
        return true
    }
}
