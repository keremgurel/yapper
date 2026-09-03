@preconcurrency import AppKit
import CoreGraphics
import SwiftUI

struct TimelinePanel: View {
    @ObservedObject var session: EditorSession
    /// Own the viewport without subscribing this whole panel to it. Only the
    /// moving pieces below observe `viewport` directly.
    @StateObject private var viewportOwner = TimelineViewportOwner()
    /// Held here rather than read per event: the scroller has to be off for the
    /// whole time the key is down, not decided again on each scroll.
    @StateObject private var commandKey = CommandKeyMonitor()
    /// Mirrors the layout computed inside the `GeometryReader` so the toolbar
    /// zoom slider, which sits above it, can anchor its own zooms.
    @State private var layoutSnapshot = TimelineViewportLayout(
        duration: 0,
        viewportWidth: 1,
        minimumContentWidth: 280,
        leadingInset: 84,
        trailingInset: 160
    )
    private let trackHeaderWidth = 71.0
    private let leadingTimelineInset = 84.0
    private let trailingTimelineInset = 160.0

    private var viewport: TimelineViewportState { viewportOwner.viewport }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text("Timeline")
                    .font(.studioBodyStrong)
                Text("\(session.project.clips.count) clips")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                Button {
                    session.toggleTimelineSnapping()
                } label: {
                    AdaptiveControlLabel(
                        title: session.isTimelineSnappingEnabled ? "Snap on" : "Snap off",
                        systemImage: session.isTimelineSnappingEnabled ? "magnet" : "magnet.slash",
                        compactTitle: "Snap"
                    )
                        .font(.studioCaptionStrong)
                        .foregroundStyle(session.isTimelineSnappingEnabled ? Color.yapperOrange : Color.secondary)
                        .padding(.horizontal, 8)
                        .frame(height: 26)
                        .background(session.isTimelineSnappingEnabled ? Color.yapperOrange.opacity(0.12) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .stroke(session.isTimelineSnappingEnabled ? Color.yapperOrange.opacity(0.32) : Color.studioLine, lineWidth: 1)
                        }
                }
                .buttonStyle(.studioPlain)
                .help("Snap to the playhead, edges, seconds, and audio transients · hold Option to bypass")
                .accessibilityHint("Snap to the playhead, edges, seconds, and audio transients. Hold Option to bypass.")
                Divider()
                    .frame(height: 18)
                TimelineActionButton(
                    title: "Split",
                    systemImage: "scissors",
                    shortcut: "S",
                    help: "Split the selected item at the playhead"
                ) {
                    Task { await session.splitAtPlayhead() }
                }
                .disabled(session.project.clips.isEmpty)
                TimelineActionButton(
                    title: "Trim Start",
                    systemImage: "arrow.right.to.line",
                    shortcut: "[",
                    help: "Pull the selected item's left edge to the playhead"
                ) {
                    Task { await session.trimTimelineSelection(toPlayhead: .leading) }
                }
                .disabled(!session.hasPlayheadCommandTarget)
                TimelineActionButton(
                    title: "Trim End",
                    systemImage: "arrow.left.to.line",
                    shortcut: "]",
                    help: "Pull the selected item's right edge to the playhead"
                ) {
                    Task { await session.trimTimelineSelection(toPlayhead: .trailing) }
                }
                .disabled(!session.hasPlayheadCommandTarget)
                TimelineActionButton(
                    title: "Delete",
                    systemImage: "trash",
                    shortcut: "⌫",
                    help: "Delete the selected timeline items"
                ) {
                    Task { await session.deleteTimelineSelection() }
                }
                .disabled(!session.hasTimelineSelection)
                TimelineActionButton(
                    title: "Auto-trim",
                    systemImage: "waveform",
                    shortcut: "⇧⌘T",
                    help: "Remove silent gaps across the timeline"
                ) {
                    Task { await session.autoTrimSilences() }
                }
                .disabled(session.project.clips.isEmpty || session.isBusy)
                Spacer()
                Image(systemName: "minus.magnifyingglass")
                    .foregroundStyle(.secondary)
                TimelineZoomSlider(viewport: viewport, layout: layoutSnapshot)
                Image(systemName: "plus.magnifyingglass")
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 14)
            .frame(height: 38)
            .background(Color.panelBackground)

            GeometryReader { proxy in
                let layout = timelineLayout(panelWidth: proxy.size.width)
                let contentHeight = max(session.timelineRowLayout.contentHeight, proxy.size.height)
                // When every track already fits, the scroller must be inert.
                // Left enabled it still rubber-banded, which dragged the ruler
                // out of view part-way through a zoom gesture.
                let tracksFit = contentHeight <= proxy.size.height + 0.5
                VStack(spacing: 0) {
                TimelineRulerHeader(
                    session: session,
                    viewport: viewport,
                    clock: session.playbackClock,
                    layout: layout,
                    railWidth: TimelineTrackRail.width
                )
                ScrollView(.vertical, showsIndicators: !tracksFit) {
                    HStack(spacing: 0) {
                        TimelineTrackRail(
                            session: session,
                            layout: session.timelineRowLayout
                        )
                            .frame(width: TimelineTrackRail.width)
                        Rectangle().fill(Color.studioLine).frame(width: 1)
                        TimelineViewport(
                            session: session,
                            viewport: viewport,
                            layout: layout,
                            contentHeight: contentHeight
                        )
                    }
                    .frame(height: contentHeight)
                }
                // Command means zoom, and only zoom. The scroll monitor claims
                // those events for the zoom and consumes them, but consuming is
                // a promise made one event at a time; switching the scroller
                // off while the key is down is the promise kept.
                .scrollDisabled(tracksFit || commandKey.isHeld)
                .scrollBounceBehavior(.basedOnSize)
                // Outside the vertical scroller so the monitor's window frame
                // always matches the visible timeline, whatever the tracks are
                // scrolled to.
                .background {
                    TimelineScrollInputView(
                        layout: layout,
                        viewportOriginX: trackHeaderWidth,
                        onZoom: { factor, anchorX in
                            viewport.zoom(by: factor, anchorX: anchorX, layout: layout)
                        },
                        onPan: { delta in
                            viewport.pan(by: delta, layout: layout)
                        }
                    )
                }
                .overlay(alignment: .bottomTrailing) {
                    TimelineScrollBarOverlay(viewport: viewport, layout: layout)
                        .padding(.bottom, 2)
                }
                .onChange(of: layout, initial: true) { _, updated in
                    viewport.reconcile(with: updated)
                    // The snapshot is only read by the zoom slider, which has
                    // no pointer to anchor on and uses the middle of the
                    // viewport instead. It is `@State`, so writing it rebuilds
                    // the whole panel down to the toolbar, and the layout
                    // changes on every frame of a horizontal drag. A step is
                    // close enough for a slider that is not being touched.
                    guard
                        layoutSnapshot.duration != updated.duration
                            || abs(layoutSnapshot.viewportWidth - updated.viewportWidth)
                                >= PaneSizeStep.standard
                    else { return }
                    layoutSnapshot = updated
                }
                }
            }
        }
        .background {
            ZStack {
                Color.editorBackground
                TimelineKeyCommandView { command in
                    performKeyCommand(command)
                }
                TimelineDragWatchdog {
                    session.recoverStrandedTimelineDrag()
                }
            }
        }
        .overlay(alignment: .top) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }

    private func timelineLayout(panelWidth: Double) -> TimelineViewportLayout {
        let viewportWidth = max(1, panelWidth - trackHeaderWidth)
        return TimelineViewportLayout(
            duration: session.duration,
            viewportWidth: viewportWidth,
            minimumContentWidth: max(280, min(520, viewportWidth * 0.52)),
            leadingInset: leadingTimelineInset,
            trailingInset: trailingTimelineInset
        )
    }

    private func performKeyCommand(_ command: TimelineKeyCommand) {
        switch command {
        case .togglePlayback:
            session.togglePlayback()
        case .split:
            Task { await session.splitAtPlayhead() }
        case .delete:
            Task { await session.deleteTimelineSelection() }
        case .trimLeading:
            Task { await session.trimTimelineSelection(toPlayhead: .leading) }
        case .trimTrailing:
            Task { await session.trimTimelineSelection(toPlayhead: .trailing) }
        case .stepBack:
            session.stepPlayhead(frames: -1)
        case .stepForward:
            session.stepPlayhead(frames: 1)
        case .cancelDrag:
            session.cancelTimelineDrag()
            // Escape closes whatever is open, nearest first: Chirpy, then
            // everything picked up on the canvas.
            if session.closeAssistant() { return }
            session.clearCanvasSelection()
        case .togglePreviewFullScreen:
            session.previewPresentation.toggleFullScreen()
        }
    }
}

/// The only toolbar control that follows viewport scale. Horizontal panning no
/// longer asks SwiftUI to rebuild every fixed action button beside it.
private struct TimelineZoomSlider: View {
    @ObservedObject var viewport: TimelineViewportState
    let layout: TimelineViewportLayout

    var body: some View {
        Slider(value: zoom, in: TimelineZoomGeometry.scaleRange)
            .frame(width: 130)
            .controlSize(.mini)
            .help("Pinch or ⌘-scroll over the timeline to zoom")
    }

    /// The slider has no pointer to anchor to, so it zooms about the middle of
    /// the viewport the way the zoom control in any editor does.
    private var zoom: Binding<Double> {
        Binding(
            get: { viewport.pointsPerSecond },
            set: { value in
                viewport.setPointsPerSecond(
                    value,
                    anchorX: layout.viewportWidth / 2,
                    layout: layout
                )
            }
        )
    }
}

/// The scrollbar follows the viewport without making the vertical scroller,
/// fixed rail, or toolbar follow it too.
private struct TimelineScrollBarOverlay: View {
    @ObservedObject var viewport: TimelineViewportState
    let layout: TimelineViewportLayout

    var body: some View {
        let contentWidth = layout.contentWidth(at: viewport.pointsPerSecond)
        if layout.maximumScrollX(contentWidth: contentWidth) > 0 {
            TimelineScrollBar(
                layout: layout,
                contentWidth: contentWidth,
                scrollX: viewport.scrollX
            ) { offset in
                viewport.scroll(to: offset, layout: layout)
            }
        }
    }
}


struct TimelineWaveformWindow: Equatable {
    let range: Range<Int>
    let fraction: CGFloat
}

enum TimelineWaveformGeometry {
    static func window(
        peakCount: Int,
        progress: Double,
        sourceStart: Double,
        sourceEnd: Double,
        mediaDuration: Double
    ) -> TimelineWaveformWindow {
        guard peakCount > 0, mediaDuration > 0 else {
            return TimelineWaveformWindow(range: 0 ..< 0, fraction: 0)
        }
        let estimatedTotal = progress > 0 && progress < 1
            ? max(peakCount, Int(ceil(Double(peakCount) / progress)))
            : peakCount
        let desiredStart = max(0, Int(sourceStart / mediaDuration * Double(estimatedTotal)))
        let desiredEnd = max(desiredStart, Int(ceil(sourceEnd / mediaDuration * Double(estimatedTotal))))
        let availableStart = min(peakCount, desiredStart)
        let availableEnd = min(peakCount, max(availableStart, desiredEnd))
        let desiredCount = max(1, desiredEnd - desiredStart)
        let fraction = min(1, max(0, CGFloat(availableEnd - availableStart) / CGFloat(desiredCount)))
        return TimelineWaveformWindow(range: availableStart ..< availableEnd, fraction: fraction)
    }

    static func sampleRange(
        column: Int,
        columnCount: Int,
        samples: Range<Int>
    ) -> Range<Int> {
        guard columnCount > 0, !samples.isEmpty else { return samples.lowerBound ..< samples.lowerBound }
        let sampleCount = samples.count
        let start = samples.lowerBound + Int(Double(column) / Double(columnCount) * Double(sampleCount))
        let end = min(
            samples.upperBound,
            samples.lowerBound + max(
                1,
                Int(ceil(Double(column + 1) / Double(columnCount) * Double(sampleCount)))
            )
        )
        return start ..< max(start, end)
    }
}

struct TimelineContent: View, @MainActor Equatable {
    static let coordinateSpaceName = "yapper.timeline.content"
    /// Height of the ruler strip. The viewport paints its own strip of the same
    /// height so the bar reaches the edges even when the content is narrower.
    static let rulerHeight = 34.0
    /// Tall enough for the overlay row to show real frames rather than a pill.
    static let overlayRowHeight = 54.0
    /// The caption row, which needs only enough height to read one line.
    static let captionRowHeight = 46.0
    /// Height the tracks occupy with a single overlay lane. The stack grows
    /// with the lanes, so anything laying out the timeline asks
    /// `TimelineRowLayout` rather than this.
    static let intrinsicHeight = TimelineRowLayout().contentHeight

    @ObservedObject var session: EditorSession
    let contentWidth: Double
    /// The empty margins the viewport holds either side of the content, so the
    /// background can reach across them. They are part of the timeline to look
    /// at, so they have to be part of it to drag on.
    var leadingInset: Double = 0
    var trailingInset: Double = 0
    /// Selection is an explicit render input. `session` keeps the command
    /// surface available, but reference identity cannot tell `EquatableView`
    /// that a value inside that same session changed.
    let timelineSelection: Set<TimelineSelectionItem>
    /// The stretch of timeline that gets cells. Everything outside it is off
    /// screen, and a selected item is drawn wherever it is so that carrying one
    /// past the edge never makes it vanish.
    let visibleRange: ClosedRange<Double>
    /// The band repaints itself: see TimelineMarqueeState.
    @StateObject private var marquee = TimelineMarqueeState()
    @State private var marqueeBaseSelection: Set<TimelineSelectionItem> = []
    /// Where every item sits, built when a marquee starts and dropped when it ends.
    @State private var marqueeItemFrameTable: [TimelineItemFrame] = []

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.session === rhs.session
            && lhs.contentWidth == rhs.contentWidth
            && lhs.leadingInset == rhs.leadingInset
            && lhs.trailingInset == rhs.trailingInset
            && lhs.timelineSelection == rhs.timelineSelection
            && lhs.visibleRange == rhs.visibleRange
    }

    /// What the cells draw as selected: what the session holds, plus whatever
    /// the band being dragged has caught so far.
    private func isSelected(_ item: TimelineSelectionItem) -> Bool {
        timelineSelection.contains(item) || marquee.holds(item)
    }

    /// Cells inside the visible stretch, plus anything selected so a drag can
    /// carry it anywhere without it disappearing.
    private var visibleCaptionCues: [ProjectCaptionCue] {
        session.captionCues.filter { cue in
            visibleRange.showsItem(start: cue.timelineStart, duration: cue.duration)
                || isSelected(.caption(cue.id))
        }
    }

    private var visibleTextLayers: [ProjectTextLayer]? {
        session.project.textLayers?.filter { layer in
            visibleRange.showsItem(start: layer.timelineStart, duration: layer.duration)
                || isSelected(.text(layer.id))
        }
    }

    private var visibleOverlays: [ProjectOverlay]? {
        session.project.overlays?.filter { overlay in
            visibleRange.showsItem(start: overlay.timelineStart, duration: overlay.duration)
                || isSelected(.overlay(overlay.id))
        }
    }

    private var visibleAudioLayers: [ProjectAudioLayer]? {
        session.project.audioLayers?.filter { layer in
            visibleRange.showsItem(start: layer.timelineStart, duration: layer.duration)
                || isSelected(.audio(layer.id))
        }
    }

    var body: some View {
        let layout = session.timelineRowLayout
        let textRowY = layout.textRowY
        let captionRowY = layout.captionRowY
        let clipRowY = layout.clipRowY
        // Which row each sound sits on, so two that overlap in time do not
        // overlap on screen. Worked out from every sound, not just the visible
        // ones: a lane that changed as you scrolled would be no lane at all.
        let audioLanes = AudioTracks.lanes(for: session.project.audioLayers ?? [])
        let playheadHeight = layout.playheadHeight

        ZStack(alignment: .topLeading) {
            // The whole of it, right up to the ruler. The rows are measured
            // from a top that includes the ruler's height even though the ruler
            // itself is drawn above the scroller, and that band used to be a
            // dead `Color.clear`: a click in the strip above the first lane hit
            // nothing at all, which is most of the empty space on a timeline
            // that has one overlay row.
            Color.editorBackground
                // Out over the margins the viewport pads with, which are empty
                // background to look at and were dead to the pointer: a marquee
                // could not be started in the strip before the first clip, the
                // widest piece of empty timeline there is.
                .padding(.leading, -leadingInset)
                .padding(.trailing, -trailingInset)
                .contentShape(Rectangle())
                .gesture(timelineTrackGesture(layout: layout))
                .zIndex(0)
            TimelineVideoTrack(
                session: session,
                drag: session.timelineDrag,
                marquee: marquee,
                contentWidth: contentWidth,
                visibleRange: visibleRange
            )
            .fixedSize(horizontal: true, vertical: true)
            .frame(height: 88, alignment: .top)
            .offset(y: clipRowY)
            .zIndex(2)

            // The landing spot for anything being carried between rows. It sits
            // above every track because the lane it is aiming at is usually not
            // the one the dragged cell lives in.
            TimelineDropOverlay(
                drag: session.timelineDrag,
                rows: layout,
                contentWidth: contentWidth,
                projectDuration: session.duration
            )
            .zIndex(19)

            ForEach(visibleCaptionCues) { cue in
                TimelineCaptionCell(
                    session: session,
                    drag: session.timelineDrag,
                    cue: cue,
                    contentWidth: contentWidth,
                    projectDuration: session.duration,
                    rowY: captionRowY,
                    selected: isSelected(.caption(cue.id))
                )
                    // The icon and label are one timeline item, not separate
                    // focus targets. At fit zoom a real project has every
                    // caption on screen, so exposing both children doubled an
                    // already large accessibility/focus tree.
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Caption: \(cue.text)")
                    .zIndex(3)
            }

            if let textLayers = visibleTextLayers, !textLayers.isEmpty {
                ForEach(textLayers) { layer in
                    TimelineTextLayerCell(
                        session: session,
                        drag: session.timelineDrag,
                        layer: layer,
                        contentWidth: contentWidth,
                        projectDuration: session.duration,
                        rowY: textRowY,
                        selected: isSelected(.text(layer.id))
                    )
                        .accessibilityLabel("Text layer: \(layer.text)")
                        .zIndex(3)
                }
            }

            if let overlays = visibleOverlays, !overlays.isEmpty {
                ForEach(overlays) { overlay in
                    if let media = session.project.media.first(where: { $0.id == overlay.mediaID }) {
                        TimelineOverlayItem(
                            session: session,
                            drag: session.timelineDrag,
                            overlay: overlay,
                            media: media,
                            thumbnails: session.thumbnailsByMedia[media.id] ?? [],
                            contentWidth: contentWidth,
                            projectDuration: session.duration,
                            rowY: layout.overlayRowY(track: overlay.lane),
                            layout: layout,
                            selected: isSelected(.overlay(overlay.id))
                        )
                        .opacity(overlay.isVisible ? 1 : 0.45)
                        .zIndex(3)
                    }
                }
            }

            if let audioLayers = visibleAudioLayers, !audioLayers.isEmpty {
                ForEach(audioLayers) { layer in
                    TimelineAudioItem(
                        session: session,
                        drag: session.timelineDrag,
                        waveforms: session.audioWaveforms,
                        levels: session.audioLevels,
                        layer: layer,
                        contentWidth: contentWidth,
                        projectDuration: session.duration,
                        rowY: layout.audioRowY(track: audioLanes[layer.id] ?? 0),
                        selected: isSelected(.audio(layer.id))
                    )
                    .zIndex(3)
                }
            }

            // Both of these move constantly, the playhead on every frame of
            // playback and the guide on every frame of a drag. They observe the
            // clock and the drag state directly so the tracks around them, with
            // their thumbnails and waveforms, stay out of it.
            if session.duration > 0 {
                TimelinePlayheadLine(
                    clock: session.playbackClock,
                    duration: session.duration,
                    contentWidth: contentWidth,
                    height: playheadHeight + 30
                )
                .zIndex(4)

                TimelineSnapGuideLine(
                    drag: session.timelineDrag,
                    duration: session.duration,
                    contentWidth: contentWidth,
                    height: playheadHeight + 30
                )
                .zIndex(5)
            }

            TimelineMarqueeBox(state: marquee)
                .zIndex(6)

        }
        .coordinateSpace(name: Self.coordinateSpaceName)
        // Files from Finder land here, on the row and the second they were let
        // go over, rather than in the bin to be fetched and carried in again.
        .timelineExternalDrop(
            session: session,
            contentWidth: contentWidth,
            rowLayout: layout
        )
    }

    /// The frame table costs a pass over every item on the timeline, and it is
    /// only ever read by a marquee. It used to be worked out on every body,
    /// which meant every keystroke in a caption paid for it; now a marquee
    /// builds it once, when it starts.
    private func timelineTrackGesture(layout: TimelineRowLayout) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.coordinateSpaceName))
            .onChanged { value in
                if marquee.origin == nil {
                    marquee.begin(at: value.startLocation, current: value.location)
                    marqueeBaseSelection = session.timelineSelection
                    marqueeItemFrameTable = marqueeItemFrames(layout: layout)
                }
                let distance = hypot(
                    value.location.x - value.startLocation.x,
                    value.location.y - value.startLocation.y
                )
                guard distance >= 4 else { return }
                marquee.drag(to: value.location)
                let flags = NSEvent.modifierFlags
                // Live: the inspector does not follow a band being dragged.
                // Syncing it per pointer move republished half the session and
                // relaid the panels out, which is what made a marquee crawl on
                // a long project. It catches up once, on let go.
                marquee.catching(
                    TimelineMarqueeGeometry.selection(
                        intersecting: TimelineMarqueeGeometry.rect(
                            from: value.startLocation,
                            to: value.location
                        ),
                        itemFrames: marqueeItemFrameTable,
                        base: marqueeBaseSelection,
                        additive: flags.contains(.shift),
                        toggling: flags.contains(.command)
                    )
                )
            }
            .onEnded { value in
                if marquee.isActive {
                    // The one time the session hears about it.
                    session.setTimelineSelection(marquee.caught)
                } else {
                    session.setTimelineSelection([])
                    session.finishScrubbing(
                        at: TimelineMetrics.time(
                            for: value.location.x,
                            duration: session.duration,
                            width: contentWidth
                        )
                    )
                }
                marquee.end()
                marqueeBaseSelection = []
                marqueeItemFrameTable = []
            }
    }

    private func marqueeItemFrames(layout: TimelineRowLayout) -> [TimelineItemFrame] {
        let textRowY = layout.textRowY
        let captionRowY = layout.captionRowY
        let clipRowY = layout.clipRowY
        let audioLanes = AudioTracks.lanes(for: session.project.audioLayers ?? [])
        guard session.duration > 0 else { return [] }
        func x(_ time: Double) -> Double { contentWidth * time / session.duration }
        var frames: [TimelineItemFrame] = []
        var cursor = 0.0
        for clip in session.project.clips {
            frames.append(
                TimelineItemFrame(
                    item: .clip(clip.id),
                    frame: CGRect(x: x(cursor), y: clipRowY, width: max(1, x(clip.duration)), height: 88)
                )
            )
            cursor += clip.duration
        }
        for layer in session.project.textLayers ?? [] {
            frames.append(
                TimelineItemFrame(
                    item: .text(layer.id),
                    frame: CGRect(x: x(layer.timelineStart), y: textRowY, width: max(1, x(layer.duration)), height: 42)
                )
            )
        }
        for overlay in session.project.overlays ?? [] {
            frames.append(
                TimelineItemFrame(
                    item: .overlay(overlay.id),
                    frame: CGRect(
                        x: x(overlay.timelineStart),
                        y: layout.overlayRowY(track: overlay.lane),
                        width: max(1, x(overlay.duration)),
                        height: Self.overlayRowHeight
                    )
                )
            )
        }
        for cue in session.captionCues {
            frames.append(
                TimelineItemFrame(
                    item: .caption(cue.id),
                    frame: CGRect(
                        x: x(cue.timelineStart),
                        y: captionRowY,
                        width: max(1, x(cue.duration)),
                        height: TimelineCaptionCell.height
                    )
                )
            )
        }
        for layer in session.project.audioLayers ?? [] {
            frames.append(
                TimelineItemFrame(
                    item: .audio(layer.id),
                    frame: CGRect(
                        x: x(layer.timelineStart),
                        y: layout.audioRowY(track: audioLanes[layer.id] ?? 0),
                        // The same floor the cell is drawn at, so a marquee
                        // catches what it visibly went over.
                        width: max(TimelineAudioItem.minimumDrawnWidth, x(layer.duration)),
                        height: 46
                    )
                )
            )
        }
        return frames
    }
}

private struct TimelineVideoTrack: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var drag: TimelineDragState
    /// Watched so a band caught over the clips draws on them, and only on them.
    @ObservedObject var marquee: TimelineMarqueeState
    let contentWidth: Double
    let visibleRange: ClosedRange<Double>

    private func isSelected(_ item: TimelineSelectionItem) -> Bool {
        session.isTimelineSelected(item) || marquee.holds(item)
    }

    var body: some View {
        // Every clip keeps its place in this stack for the whole drag and moves
        // by an offset. Nothing is added, removed or reparented mid-gesture,
        // which is what stops a drag ending without the mouse-up ever arriving
        // and leaving the gap open behind it.
        let clips = session.project.clips
        let positions = TimelineTrackLayout.positions(
            clips: clips.map { .init(id: $0.id, duration: $0.duration) },
            drag: TimelineTrackLayout.Drag(
                movingIDs: drag.reorderPlan == nil ? [] : session.draggedClipIDs,
                offset: drag.offset,
                insertionIndex: drag.reorderPlan?.insertionIndex,
                blockDuration: drag.reorderPlan?.blockDuration,
                liftedID: liftedClipID(among: clips)
            )
        )
        let movingIDs = drag.reorderPlan == nil ? [] : session.draggedClipIDs

        ZStack(alignment: .topLeading) {
            // Gated on a live gesture, not on the plan. A plan outliving its
            // gesture is what left a gap open with nothing able to close it.
            if drag.isDragging, let plan = drag.reorderPlan, liftedClipID(among: clips) == nil {
                dropGap(duration: plan.blockDuration)
                    .offset(x: x(of: gapStart(plan: plan, clips: clips)))
                    .animation(.easeOut(duration: 0.14), value: plan)
            }

            ForEach(renderedClips(clips, positions: positions, movingIDs: movingIDs)) { clip in
                let isMoving = movingIDs.contains(clip.id)
                let isLifted = liftedClipID(among: clips) == clip.id
                clipItem(for: clip, timelineStart: positions[clip.id] ?? 0)
                    .offset(x: x(of: positions[clip.id] ?? 0))
                    .shadow(
                        color: .black.opacity(isMoving || isLifted ? 0.55 : 0),
                        radius: isMoving || isLifted ? 8 : 0,
                        y: isMoving || isLifted ? 4 : 0
                    )
                    .zIndex(isMoving || isLifted ? 1 : 0)
                    // The clip under the pointer must not be eased, or it lags
                    // the mouse. Its neighbours settle into their new places.
                    .animation(
                        isMoving || isLifted
                            ? nil
                            : .spring(response: 0.26, dampingFraction: 0.86),
                        value: positions[clip.id] ?? 0
                    )
            }
        }
        .frame(width: contentWidth, height: 88, alignment: .topLeading)
    }

    /// Clips well outside the preload window have no pixels to contribute.
    /// Their positions are still calculated so reordering stays exact, while
    /// the moving/selected block is always retained under the pointer.
    private func renderedClips(
        _ clips: [TimelineClip],
        positions: [UUID: Double],
        movingIDs: Set<UUID>
    ) -> [TimelineClip] {
        clips.filter { clip in
            visibleRange.showsItem(
                start: positions[clip.id] ?? 0,
                duration: clip.duration
            )
                || movingIDs.contains(clip.id)
                || isSelected(.clip(clip.id))
        }
    }

    /// The clip currently being carried up to an overlay lane, if it is one of
    /// ours: a lift can also be an overlay moving between lanes.
    private func liftedClipID(among clips: [TimelineClip]) -> UUID? {
        guard let id = drag.lift?.itemID, clips.contains(where: { $0.id == id }) else { return nil }
        return id
    }

    /// Where the gap sits, in seconds, given the clips that are staying put.
    private func gapStart(plan: TimelineReorderPlan, clips: [TimelineClip]) -> Double {
        let staying = clips.filter { !session.draggedClipIDs.contains($0.id) }
        return staying.prefix(plan.insertionIndex).reduce(0) { $0 + $1.duration }
    }

    private func x(of seconds: Double) -> Double {
        contentWidth * seconds / max(0.001, session.duration)
    }

    @ViewBuilder
    private func clipItem(for clip: TimelineClip, timelineStart: Double) -> some View {
        if let media = session.project.media(for: clip) {
            TimelineVideoClipItem(
                session: session,
                drag: session.timelineDrag,
                levels: session.audioLevels,
                trackVolume: session.project.resolvedVideoTrackVolume,
                clip: clip,
                media: media,
                thumbnails: session.thumbnailsByMedia[media.id] ?? [],
                peaks: session.waveformByMedia[media.id] ?? [],
                waveformProgress: session.waveformProgressByMedia[media.id] ?? 0,
                contentWidth: contentWidth,
                projectDuration: session.duration,
                visibleFraction: visibleRange.visibleFraction(
                    start: timelineStart,
                    duration: clip.duration
                ),
                selected: isSelected(.clip(clip.id))
            )
        }
    }

    private func dropGap(duration: Double) -> some View {
        RoundedRectangle(cornerRadius: 5, style: .continuous)
            .fill(Color.yapperOrange.opacity(0.22))
            .overlay {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .stroke(Color.yapperOrange, lineWidth: 1.5)
            }
            .frame(width: width(of: duration), height: 88)
            .padding(.horizontal, 1)
    }

    private func width(of duration: Double) -> Double {
        max(1, contentWidth * duration / max(0.001, session.duration))
    }
}

private struct TimelineVideoClipItem: View {
    /// Held, not observed. A cell that subscribes to the session is rebuilt
    /// whenever anything in the editor changes, so typing in one caption used
    /// to re-run the body of every cell on the timeline. Everything the body
    /// draws with arrives as a value, and the reference is here only to call
    /// commands from the gestures below.
    let session: EditorSession
    @ObservedObject var drag: TimelineDragState
    /// Watched, unlike the session: the waveform is drawn at whatever the
    /// speaker's fader is set to, and it has to follow one being dragged.
    @ObservedObject var levels: AudioLevelDraft
    /// What that fader is saved at, for when nobody is dragging it.
    let trackVolume: Double
    let clip: TimelineClip
    let media: ProjectMedia
    let thumbnails: [CGImage]
    let peaks: [Float]
    let waveformProgress: Double
    let contentWidth: Double
    /// The project length the cell lays itself out against, passed in so
    /// the cell does not have to watch the session for it.
    let projectDuration: Double
    /// The portion intersecting the viewport and its preload margin. The cell
    /// stays full-width, while thumbnails and bars outside this window do not
    /// get created or drawn.
    let visibleFraction: ClosedRange<Double>
    let selected: Bool
    @State private var trimOrigin: TimelineClip?
    @State private var trimDraft: TimelineClip?
    @State private var activeTrimEdge: HorizontalEdge?
    @State private var snapAnchors: [TimelineSnapAnchor] = []
    @State private var selectionMoveBounds: (start: Double, end: Double)?
    @State private var isPromotingToOverlay = false
    /// How far the pointer has carried the clip since the drag began, used only
    /// while it is off its own row.
    @State private var carryOffset = CGSize.zero

    var body: some View {
        let displayed = trimDraft ?? clip
        let originalWidth = max(
            1,
            contentWidth * clip.duration / max(0.001, projectDuration)
        )
        let displayedWidth = max(
            1,
            contentWidth * displayed.duration / max(0.001, projectDuration)
        )
        let leadingPreviewOffset = activeTrimEdge == .leading
            ? TimelineTrimGeometry.x(
                for: displayed.sourceStart - clip.sourceStart,
                contentWidth: contentWidth,
                projectDuration: projectDuration
            )
            : 0
        let layoutWidth = activeTrimEdge == .leading ? originalWidth : displayedWidth

        ZStack(alignment: .leading) {
            TimelineMediaCell(
                name: media.name,
                sourceStart: displayed.sourceStart,
                sourceEnd: displayed.sourceEnd,
                mediaDuration: media.duration,
                thumbnails: thumbnails,
                peaks: peaks,
                waveformProgress: waveformProgress,
                height: 88,
                selected: selected,
                // The speaker's own fader, live while it is being dragged.
                volume: levels.mainTrack ?? trackVolume,
                visibleFraction: visibleFraction
            )
            // Inset the drawing, never the layout: the frame still maps exactly
            // onto the clip's duration, so the playhead and ruler stay honest
            // while neighbouring clips gain a 2pt seam between them.
            .padding(.horizontal, 1)
            .frame(width: displayedWidth, height: 88)
            // Where the picture moves, marked on the clip it moves over. A
            // punch-in is invisible on the timeline otherwise: the footage
            // looks the same whether or not anything is happening to it.
            .overlay(alignment: .bottomLeading) {
                FramingKeyMarkers(session: session, clip: displayed, cellWidth: displayedWidth)
            }
            .contentShape(Rectangle())
            .onTapGesture { selectTimelineItemFromPointer(.clip(clip.id), session: session) }
            .gesture(selectionMoveGesture)
            .overlay(alignment: .leading) {
                if selected { trimHandle(edge: .leading) }
            }
            .overlay(alignment: .trailing) {
                if selected { trimHandle(edge: .trailing) }
            }
            .offset(x: leadingPreviewOffset)
        }
        .frame(width: layoutWidth, height: 88, alignment: .leading)
        // Where the clip sits along the track is the track's business — see
        // `TimelineTrackLayout`. All that is left here is the lift: once the
        // clip has been carried off its own row it follows the pointer freely,
        // in both directions.
        .offset(
            x: isPromotingToOverlay ? carryOffset.width : 0,
            y: isPromotingToOverlay ? carryOffset.height : 0
        )
        .scaleEffect(isPromotingToOverlay ? 0.96 : 1, anchor: .center)
        .opacity(isPromotingToOverlay ? 0.9 : 1)
        .zIndex(isPromotingToOverlay ? 30 : (activeTrimEdge == nil ? 0 : 10))
        .transaction { transaction in
            transaction.disablesAnimations = true
        }
        .contextMenu {
            PropertiesMenuItems(session: session, item: .clip(clip.id))
            Divider()
            Button {
                session.select(clip.id)
                Task { await session.splitAtPlayhead() }
            } label: {
                Label("Split at playhead", systemImage: "scissors")
            }

            Button {
                Task { await session.resetMediaToSource(media.id) }
            } label: {
                Label("Reset this media to source", systemImage: "arrow.counterclockwise")
            }

            Button {
                NSWorkspace.shared.activateFileViewerSelecting([media.url])
            } label: {
                Label("Reveal source in Finder", systemImage: "folder")
            }

            Divider()
            Button(role: .destructive) {
                session.select(clip.id)
                Task { await session.deleteSelected() }
            } label: {
                Label("Remove clip from timeline", systemImage: "trash")
            }

            Button(role: .destructive) {
                Task { await session.deleteImportedMedia(media.id) }
            } label: {
                Label("Remove media from project", systemImage: "trash.slash")
            }
        }
    }

    private var selectionMoveGesture: some Gesture {
        DragGesture(
            minimumDistance: 3,
            coordinateSpace: .named(TimelineContent.coordinateSpaceName)
        )
            .onChanged { value in
                guard activeTrimEdge == nil else { return }
                if selectionMoveBounds == nil {
                    session.ensureTimelineItemSelected(.clip(clip.id))
                    selectionMoveBounds = session.timelineSelectionBounds()
                    snapAnchors = session.timelineSnapAnchors(carrying: .clip(clip.id))
                    session.beginTimelineDrag(clip.id)
                }
                // Escape has already put everything back, so the rest of this
                // gesture is somebody holding a mouse button down over nothing.
                guard !session.isTimelineDragCancelled else {
                    isPromotingToOverlay = false
                    carryOffset = .zero
                    return
                }
                guard let selectionMoveBounds else { return }

                let move = timelineSelectionMove(
                    session: session,
                    bounds: selectionMoveBounds,
                    rawTranslationX: value.location.x - value.startLocation.x,
                    contentWidth: contentWidth,
                    snapAnchors: snapAnchors
                )
                // One proposal answers both questions at once — which row, and
                // where along it — so what is drawn and what happens on release
                // come from the same numbers.
                let target = TimelineDropGeometry.target(
                    pointerY: Double(value.location.y),
                    leadingEdgeTime: clip.timelineStart(in: session.project) + move.delta,
                    duration: clip.duration,
                    rows: session.timelineRowLayout,
                    stationaryDurations: [],
                    projectDuration: projectDuration,
                    // Lifting this clip takes its length out of the track, so
                    // the room left for it is that much shorter. Working it out
                    // here is what keeps the ghost honest about where it lands.
                    latestStart: max(0, projectDuration - 2 * clip.duration),
                    contentWidth: contentWidth,
                    snapAnchors: snapAnchors,
                    isSnappingEnabled: session.isTimelineSnappingEnabled,
                    canLift: session.project.clips.count > 1
                )

                if target.isOverlay {
                    isPromotingToOverlay = true
                    carryOffset = CGSize(
                        width: value.location.x - value.startLocation.x,
                        height: value.location.y - value.startLocation.y
                    )
                    // It is leaving the track, so the track stops previewing a
                    // reorder and closes up behind it instead. Leaving the
                    // reorder in place is what left a gap open after the drop.
                    session.cancelTimelineSelectionMove()
                    session.setActiveTimelineSnap(target.snap)
                    session.setTimelineLift(
                        TimelineLift(
                            itemID: clip.id,
                            title: media.name,
                            duration: clip.duration,
                            target: session.blocking(target, ignoring: clip.id)
                        )
                    )
                } else {
                    isPromotingToOverlay = false
                    session.setTimelineLift(nil)
                    session.previewTimelineSelectionMove(delta: move.delta)
                    session.setActiveTimelineSnap(move.match)
                }
            }
            .onEnded { _ in
                let lift = session.timelineDrag.lift
                let wasCancelled = session.isTimelineDragCancelled
                session.endTimelineDrag()
                isPromotingToOverlay = false
                carryOffset = .zero
                selectionMoveBounds = nil
                snapAnchors = []
                session.setActiveTimelineSnap(nil)
                session.setTimelineLift(nil)
                if wasCancelled {
                    session.cancelTimelineSelectionMove()
                } else if let lift, let lane = lift.target.overlayLane, !lift.target.isBlocked {
                    Task { await session.promoteClipToOverlay(clip.id, start: lift.target.start, lane: lane) }
                } else {
                    Task { await session.commitTimelineSelectionMove() }
                }
            }
    }

    private func trimHandle(edge: HorizontalEdge) -> some View {
        let displayed = trimDraft ?? clip
        let edgeTime = edge == .leading ? displayed.sourceStart : displayed.sourceEnd
        return TimelineTrimHandle(
            edge: edge,
            height: 82,
            isActive: activeTrimEdge == edge,
            readout: activeTrimEdge == edge ? formatTimelineTrimTime(edgeTime) : nil
        )
            .highPriorityGesture(
                DragGesture(
                    minimumDistance: 0,
                    coordinateSpace: .named(TimelineContent.coordinateSpaceName)
                )
                    .onChanged { value in
                        if trimOrigin == nil {
                            trimOrigin = clip
                            activeTrimEdge = edge
                            snapAnchors = session.timelineSnapAnchors(carrying: .clip(clip.id))
                            session.ensureTimelineItemSelected(.clip(clip.id))
                        }
                        guard let trimOrigin else { return }
                        let rawTranslation = value.location.x - value.startLocation.x
                        let rawDraft = TimelineClipGeometry.trimmed(
                            clip: trimOrigin,
                            edge: edge,
                            translationX: rawTranslation,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration,
                            mediaDuration: media.isImage ? nil : media.duration
                        )
                        let timelineStart = session.project.timelineStart(for: clip.id) ?? 0
                        let originalEdgeTime = edge == .leading
                            ? timelineStart
                            : timelineStart + trimOrigin.duration
                        let proposedEdgeTime = edge == .leading
                            ? timelineStart + rawDraft.sourceStart - trimOrigin.sourceStart
                            : timelineStart + rawDraft.duration
                        let adjusted = TimelineSnapDragGeometry.trimTranslation(
                            originalEdgeTime: originalEdgeTime,
                            proposedEdgeTime: proposedEdgeTime,
                            rawTranslationX: rawTranslation,
                            anchors: snapAnchors,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration,
                            enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                        )
                        trimDraft = TimelineClipGeometry.trimmed(
                            clip: trimOrigin,
                            edge: edge,
                            translationX: adjusted.translationX,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration,
                            mediaDuration: media.isImage ? nil : media.duration
                        )
                        session.setActiveTimelineSnap(adjusted.match)
                    }
                    .onEnded { _ in
                        let committedTrim = trimDraft
                        trimDraft = nil
                        trimOrigin = nil
                        activeTrimEdge = nil
                        snapAnchors = []
                        session.setActiveTimelineSnap(nil)
                        guard let committedTrim else { return }
                        Task {
                            await session.commitClipTrim(committedTrim)
                        }
                    }
            )
            .help(edge == .leading ? "Extend or trim clip start" : "Extend or trim clip end")
    }
}

enum TimelineClipGeometry {
    static func trimmed(
        clip: TimelineClip,
        edge: HorizontalEdge,
        translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double,
        /// How much footage sits behind the clip, or nil for a still, which has
        /// no end to run out of and can be held for as long as it is wanted.
        mediaDuration: Double?
    ) -> TimelineClip {
        var updated = clip
        guard projectDuration > 0, contentWidth > 0 else { return updated }
        let delta = TimelineTrimGeometry.timeDelta(
            for: translationX,
            contentWidth: contentWidth,
            projectDuration: projectDuration
        )
        let minimumDuration = 1.0 / 30.0
        switch edge {
        case .leading:
            updated.sourceStart = min(
                clip.sourceEnd - minimumDuration,
                max(0, clip.sourceStart + delta)
            )
        case .trailing:
            let wanted = max(clip.sourceStart + minimumDuration, clip.sourceEnd + delta)
            updated.sourceEnd = mediaDuration.map { min(wanted, $0) } ?? wanted
        }
        return updated
    }
}

struct TimelineTrimHandle: View {
    let edge: HorizontalEdge
    let height: CGFloat
    let isActive: Bool
    let readout: String?
    @State private var isHovering = false

    var body: some View {
        ZStack(alignment: edge == .leading ? .leading : .trailing) {
            Color.clear
            Capsule(style: .continuous)
                .fill(Color.white.opacity(isActive ? 1 : 0.94))
                .frame(width: isActive ? 3 : 2.5, height: min(30, height * 0.58))
                .overlay {
                    Capsule(style: .continuous)
                        .stroke(Color.black.opacity(0.38), lineWidth: 0.55)
                }
        }
        // A wide target, and a wider one still for the pointer: the arrows have
        // to appear before the handle is reached, or a trim feels like it needs
        // aiming for.
        .frame(width: 22, height: height)
        .contentShape(Rectangle().inset(by: -6))
        .cursor(.resizeLeftRight)
        .overlay(alignment: .top) {
            if let readout {
                Text(readout)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 7)
                    .frame(height: 22)
                    .background(Color.black.opacity(0.88))
                    .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 5, style: .continuous)
                            .stroke(Color.white.opacity(0.34), lineWidth: 0.7)
                    }
                    .fixedSize()
                    .offset(y: -25)
                    .allowsHitTesting(false)
            }
        }
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.08), value: isHovering)
    }
}

func formatTimelineTrimTime(_ seconds: Double) -> String {
    guard seconds.isFinite else { return "0:00.000" }
    let safe = max(0, seconds)
    let minutes = Int(safe) / 60
    let remainder = safe - Double(minutes * 60)
    return String(format: "%d:%06.3f", minutes, remainder)
}

private struct TimelineOverlayItem: View {
    /// Held, not observed. A cell that subscribes to the session is rebuilt
    /// whenever anything in the editor changes, so typing in one caption used
    /// to re-run the body of every cell on the timeline. Everything the body
    /// draws with arrives as a value, and the reference is here only to call
    /// commands from the gestures below.
    let session: EditorSession
    @ObservedObject var drag: TimelineDragState
    let overlay: ProjectOverlay
    let media: ProjectMedia
    let thumbnails: [CGImage]
    let contentWidth: Double
    /// The project length the cell lays itself out against, passed in so
    /// the cell does not have to watch the session for it.
    let projectDuration: Double
    let rowY: Double
    let layout: TimelineRowLayout
    let selected: Bool
    @State private var trimOrigin: ProjectOverlay?
    @State private var trimDraft: ProjectOverlay?
    @State private var moveOrigin: ProjectOverlay?
    @State private var moveDraft: ProjectOverlay?
    @State private var activeTrimEdge: HorizontalEdge?
    @State private var snapAnchors: [TimelineSnapAnchor] = []
    @State private var selectionMoveBounds: (start: Double, end: Double)?
    /// The lane the pointer is currently over, so a drag up or down the stack
    /// lands where it looks like it will.
    @State private var draggedToTrack: Int?
    /// Carried all the way down onto the speaker's own track, where it stops
    /// being an overlay. The cell rides down with the pointer so it is obvious
    /// that is what letting go would do.
    @State private var isOverVideoTrack = false
    /// Where it would sit once the track has opened up for it. The video track
    /// is magnetic, so the cell settles into that space rather than floating
    /// wherever the pointer happens to be — it fills the gap it is making.
    @State private var videoDropStart: Double?
    /// Where the pointer actually is, before snapping pulls the drop onto a
    /// guide. The cell floats here while the ghost sits on the landing spot, so
    /// the two are visibly different things — which is the only way to see where
    /// a drag is going while it is still going there.
    /// The edge a slide has come to rest against on its own lane, when it has.
    @State private var laneLandingMatch: TimelineSnapMatch?
    @State private var freeMoveStart: Double?

    var body: some View {
        let displayed = trimDraft ?? moveDraft ?? overlay
        let startX = contentWidth
            * (videoDropStart ?? freeMoveStart ?? displayed.timelineStart)
            / max(0.001, projectDuration)
        let width = max(1, contentWidth * displayed.duration / max(0.001, projectDuration))
        let isMoving = moveDraft != nil
        // Deliberately not a Button. A button takes the mouse-down for itself
        // and only lets the drag through in bursts, so the cell appeared to sit
        // still and then jump to its new home on release. Every other cell on
        // the timeline selects on tap and drags on drag, and this one has to
        // work the same way.
        //
        // Same cell as the video track: a promoted clip is the same footage on
        // another row, so it has to look like the footage it came from.
        TimelineMediaCell(
            name: media.name,
            sourceStart: displayed.sourceStart,
            sourceEnd: displayed.sourceStart + displayed.duration,
            mediaDuration: media.duration,
            thumbnails: thumbnails,
            peaks: [],
            waveformProgress: 0,
            height: TimelineContent.overlayRowHeight,
            selected: selected,
            idleBorder: Color.yapperOrange.opacity(0.62),
            badgeIcon: "photo.on.rectangle"
        )
        .padding(.horizontal, 1)
        .frame(width: width, height: TimelineContent.overlayRowHeight)
        .clipped()
        .overlay(alignment: .bottomLeading) {
            OverlayKeyMarkers(session: session, overlay: displayed, cellWidth: width)
        }
        .contentShape(Rectangle())
        .onTapGesture { selectTimelineItemFromPointer(.overlay(overlay.id), session: session) }
        // A cutaway is the thing people want to crop, and the cell on the
        // timeline is where they are looking at it.
        .contextMenu {
            PropertiesMenuItems(session: session, item: .overlay(overlay.id))
            Divider()
            Button {
                session.beginCropping(overlayID: overlay.id)
            } label: {
                Label("Crop…", systemImage: "crop")
            }
            Button {
                session.setOverlayHidden(overlay, hidden: overlay.isVisible)
            } label: {
                Label(
                    overlay.isVisible ? "Hide" : "Show",
                    systemImage: overlay.isVisible ? "eye.slash" : "eye"
                )
            }
            Divider()
            Button(role: .destructive) {
                Task { await session.deleteOverlay(overlay.id) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        // Picked up: it lifts off the lane and says where it is, because one
        // second of a lane looks exactly like every other second of it. It also
        // goes translucent, so the dashed landing box stays readable through it
        // on the stretch of the drag where the two happen to line up.
        .opacity(isMoving ? 0.72 : 1)
        .scaleEffect(isMoving ? 1.02 : 1, anchor: .center)
        .shadow(
            color: .black.opacity(isMoving ? 0.55 : 0),
            radius: isMoving ? 10 : 0,
            y: isMoving ? 5 : 0
        )
        .overlay(alignment: .top) {
            if isMoving {
                Text(TimelineDropInsertionLine.clock(displayed.timelineStart))
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5)
                    .frame(height: 15)
                    .background(Color.yapperOrange)
                    .clipShape(Capsule(style: .continuous))
                    .fixedSize()
                    .offset(y: -18)
            }
        }
        .animation(.easeOut(duration: 0.12), value: isMoving)
        .gesture(
            DragGesture(
                minimumDistance: 2,
                coordinateSpace: .named(TimelineContent.coordinateSpaceName)
            )
                .onChanged { value in
                    guard activeTrimEdge == nil else { return }
                    if moveOrigin == nil, selectionMoveBounds == nil {
                        session.ensureTimelineItemSelected(.overlay(overlay.id))
                        snapAnchors = session.timelineSnapAnchors(carrying: .overlay(overlay.id))
                        session.beginTimelineDrag(overlay.id)
                        if session.timelineSelection.count > 1 {
                            selectionMoveBounds = session.timelineSelectionBounds()
                        } else {
                            moveOrigin = overlay
                        }
                    }
                    guard !session.isTimelineDragCancelled else {
                        moveDraft = nil
                        draggedToTrack = nil
                        isOverVideoTrack = false
                        videoDropStart = nil
                        freeMoveStart = nil
                        return
                    }
                    if let selectionMoveBounds {
                        let move = timelineSelectionMove(
                            session: session,
                            bounds: selectionMoveBounds,
                            rawTranslationX: value.location.x - value.startLocation.x,
                            contentWidth: contentWidth,
                            snapAnchors: snapAnchors
                        )
                        session.previewTimelineSelectionMove(delta: move.delta)
                        session.setActiveTimelineSnap(move.match)
                        return
                    }
                    guard let moveOrigin else { return }
                    let rawTranslation = value.location.x - value.startLocation.x
                    let rawDraft = TimelineOverlayGeometry.moved(
                        overlay: moveOrigin,
                        translationX: rawTranslation,
                        contentWidth: contentWidth,
                        projectDuration: projectDuration
                    )
                    let adjusted = TimelineSnapDragGeometry.moveTranslation(
                        originalStart: moveOrigin.timelineStart,
                        proposedStart: rawDraft.timelineStart,
                        duration: rawDraft.duration,
                        rawTranslationX: rawTranslation,
                        anchors: snapAnchors,
                        contentWidth: contentWidth,
                        projectDuration: projectDuration,
                        enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                    )
                    moveDraft = TimelineOverlayGeometry.moved(
                        overlay: moveOrigin,
                        translationX: adjusted.translationX,
                        contentWidth: contentWidth,
                        projectDuration: projectDuration
                    )
                    // Pulled onto the snap while one is in reach, so lining a
                    // cutaway up with a clip edge, a sound or the playhead can
                    // be felt and not only seen. Nothing is forced: the pull
                    // reaches exactly as far as the snap threshold, Option
                    // turns it off, and an item no longer sticks to its own
                    // edges — see `timelineSnapAnchors(carrying:)`.
                    freeMoveStart = adjusted.match == nil
                        ? rawDraft.timelineStart
                        : moveDraft?.timelineStart ?? rawDraft.timelineStart
                    // Pushed into the cutaway next to it on the lane: it comes
                    // to rest against that one rather than sliding over it,
                    // which is the whole of "put this straight after that".
                    if let draft = moveDraft,
                       let landing = session.laneLanding(
                           for: draft,
                           reach: TimelineTrimGeometry.timeDelta(
                               for: 24,
                               contentWidth: contentWidth,
                               projectDuration: projectDuration
                           )
                       ) {
                        moveDraft?.timelineStart = landing.start
                        freeMoveStart = landing.start
                        // The guide marks the edge it came to rest against, so
                        // the reason it stopped is on screen.
                        laneLandingMatch = TimelineSnapMatch(
                            time: landing.against,
                            kind: .boundary,
                            distancePixels: 0
                        )
                    } else {
                        laneLandingMatch = nil
                    }
                    // The same proposal the video track uses, so an overlay can
                    // be carried onto a brand new lane on top, or all the way
                    // down onto the speaker's own track.
                    let proposed = TimelineDropGeometry.target(
                        pointerY: Double(value.location.y),
                        leadingEdgeTime: moveDraft?.timelineStart ?? overlay.timelineStart,
                        duration: moveDraft?.duration ?? overlay.duration,
                        rows: layout,
                        stationaryDurations: session.project.clips.map(\.duration),
                        projectDuration: session.duration,
                        contentWidth: contentWidth,
                        snapAnchors: snapAnchors,
                        isSnappingEnabled: false,
                        canLift: true
                    )
                    let target: TimelineDropTarget
                    if case let .overlay(lane, _) = proposed.track {
                        draggedToTrack = lane
                        isOverVideoTrack = false
                        videoDropStart = nil
                        session.previewVideoTrackInsertion(index: nil, duration: 0)
                        target = TimelineDropTarget(
                            track: .overlay(lane: lane, isNew: lane >= layout.overlayTrackCount),
                            start: moveDraft?.timelineStart ?? overlay.timelineStart,
                            snap: adjusted.match
                        )
                    } else {
                        // On its way back down to the video track, where it
                        // stops being an overlay altogether. The track opens the
                        // space it will fill, exactly as it would for a clip
                        // already living there.
                        draggedToTrack = nil
                        isOverVideoTrack = true
                        videoDropStart = proposed.start
                        session.previewVideoTrackInsertion(
                            index: proposed.videoInsertionIndex,
                            duration: moveDraft?.duration ?? overlay.duration
                        )
                        target = proposed
                    }
                    session.setActiveTimelineSnap(laneLandingMatch ?? adjusted.match)

                    // A move along the overlay's own lane shows exactly one
                    // thing: the cell, sitting on the spot it will land on. The
                    // ghost is for a carry to somewhere else, which is what a
                    // lift means and what the clip track already does. Drawing
                    // both for an ordinary slide gave two copies of the same
                    // overlay moving at once, which reads as duplication.
                    let staysInItsLane: Bool
                    if case let .overlay(lane, isNew) = target.track {
                        staysInItsLane = !isNew && lane == overlay.lane
                    } else {
                        staysInItsLane = false
                    }
                    if staysInItsLane {
                        // One moving copy. A slide along the lane needs no
                        // landing ghost: the cell is the preview, and the snap
                        // guide already says where it will settle.
                        session.setTimelineLift(nil)
                    } else {
                        // Carried off its lane, where the ghost earns its place:
                        // it marks a spot in a different row that the cell under
                        // the pointer cannot show.
                        session.setTimelineLift(
                            TimelineLift(
                                itemID: overlay.id,
                                title: media.name,
                                duration: moveDraft?.duration ?? overlay.duration,
                                target: session.blocking(
                                    target,
                                    ignoring: overlay.id,
                                    reach: TimelineTrimGeometry.timeDelta(
                                        for: 24,
                                        contentWidth: contentWidth,
                                        projectDuration: projectDuration
                                    )
                                )
                            )
                        )
                    }
                }
                .onEnded { _ in
                    laneLandingMatch = nil
                    let lift = session.timelineDrag.lift
                    let wasCancelled = session.isTimelineDragCancelled
                    session.endTimelineDrag()
                    session.setTimelineLift(nil)
                    if wasCancelled {
                        // Every scrap of where-it-was-going has to go, or the
                        // cell keeps being drawn at the spot it was carried to
                        // while the project still holds the spot it came from —
                        // a move that looks like it happened but did not.
                        moveDraft = nil
                        moveOrigin = nil
                        draggedToTrack = nil
                        isOverVideoTrack = false
                        videoDropStart = nil
                        freeMoveStart = nil
                        selectionMoveBounds = nil
                        snapAnchors = []
                        session.previewVideoTrackInsertion(index: nil, duration: 0)
                        session.cancelTimelineSelectionMove()
                        session.setActiveTimelineSnap(nil)
                        return
                    }
                    if selectionMoveBounds != nil {
                        selectionMoveBounds = nil
                        snapAnchors = []
                        session.setActiveTimelineSnap(nil)
                        Task { await session.commitTimelineSelectionMove() }
                        return
                    }
                    // Carried all the way down: it stops being an overlay and
                    // becomes a cut of its own, where the ghost said it would.
                    if let index = lift?.target.videoInsertionIndex, lift?.target.isBlocked != true {
                        moveDraft = nil
                        moveOrigin = nil
                        draggedToTrack = nil
                        isOverVideoTrack = false
                        videoDropStart = nil
                        freeMoveStart = nil
                        snapAnchors = []
                        // The gap stops being a preview and becomes the edit, so
                        // it closes here rather than waiting to be tidied away.
                        session.previewVideoTrackInsertion(index: nil, duration: 0)
                        session.setActiveTimelineSnap(nil)
                        Task { await session.demoteOverlayToClip(overlay.id, insertionIndex: index) }
                        return
                    }
                    if var moved = moveDraft {
                        // A lane change and a time change are one gesture, so
                        // they land as one edit and undo together. A lane the
                        // preview showed as busy keeps its refusal here.
                        if let draggedToTrack,
                           draggedToTrack != overlay.lane,
                           lift?.target.isBlocked != true {
                            moved.track = draggedToTrack
                        }
                        session.commitOverlayEdit(moved)
                    }
                    moveDraft = nil
                    moveOrigin = nil
                    draggedToTrack = nil
                    isOverVideoTrack = false
                    videoDropStart = nil
                    freeMoveStart = nil
                    snapAnchors = []
                    session.previewVideoTrackInsertion(index: nil, duration: 0)
                    session.setActiveTimelineSnap(nil)
                }
        )
        .overlay(alignment: .leading) {
            if selected { trimHandle(.leading) }
        }
        .overlay(alignment: .trailing) {
            if selected { trimHandle(.trailing) }
        }
        .offset(
            x: startX + (selected
                ? TimelineTrimGeometry.x(
                    for: drag.offset,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                : 0),
            y: draggedRowY
        )
        // Sliding along the track has to stay locked to the pointer, but
        // changing lane is a decision — it glides, so the eye can follow the
        // cell from one lane to the next instead of finding it somewhere new.
        .animation(.spring(response: 0.24, dampingFraction: 0.84), value: draggedRowY)
    }

    /// The row the cell is drawn on: the lane it is being carried to while a
    /// drag is running, otherwise its own.
    private var draggedRowY: Double {
        if isOverVideoTrack { return layout.clipRowY }
        guard let draggedToTrack else { return rowY }
        guard draggedToTrack < layout.overlayTrackCount else {
            // A lane that does not exist yet has no row of its own, so the cell
            // rides one row above the stack — exactly where the lane will be.
            return max(
                TimelineRowLayout.rulerHeight + 4,
                layout.overlayStackTop - TimelineRowLayout.overlayRowHeight + TimelineRowLayout.cellInset
            )
        }
        return layout.overlayRowY(track: draggedToTrack)
    }

    /// How much footage the cell can be pulled back out to, or nil for a still,
    /// which has no in point and no end to run out of.
    private var trimmableSourceDuration: Double? {
        media.isImage ? nil : media.duration
    }

    private func trimHandle(_ edge: HorizontalEdge) -> some View {
        let displayed = trimDraft ?? overlay
        let edgeTime = edge == .leading
            ? displayed.timelineStart
            : displayed.timelineStart + displayed.duration
        return TimelineTrimHandle(
            edge: edge,
            height: TimelineContent.overlayRowHeight - 4,
            isActive: activeTrimEdge == edge,
            readout: activeTrimEdge == edge ? formatTimelineTrimTime(edgeTime) : nil
        )
            .highPriorityGesture(
                DragGesture(
                    minimumDistance: 0,
                    coordinateSpace: .named(TimelineContent.coordinateSpaceName)
                )
                    .onChanged { value in
                        if trimOrigin == nil {
                            trimOrigin = overlay
                            activeTrimEdge = edge
                            snapAnchors = session.timelineSnapAnchors(carrying: .overlay(overlay.id))
                            session.ensureTimelineItemSelected(.overlay(overlay.id))
                        }
                        guard let trimOrigin else { return }
                        let rawTranslation = value.location.x - value.startLocation.x
                        let rawDraft = TimelineOverlayGeometry.trimmed(
                            overlay: trimOrigin,
                            edge: edge,
                            translationX: rawTranslation,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration,
                            sourceDuration: trimmableSourceDuration
                        )
                        let originalEdgeTime = edge == .leading
                            ? trimOrigin.timelineStart
                            : trimOrigin.timelineStart + trimOrigin.duration
                        let proposedEdgeTime = edge == .leading
                            ? rawDraft.timelineStart
                            : rawDraft.timelineStart + rawDraft.duration
                        let adjusted = TimelineSnapDragGeometry.trimTranslation(
                            originalEdgeTime: originalEdgeTime,
                            proposedEdgeTime: proposedEdgeTime,
                            rawTranslationX: rawTranslation,
                            anchors: snapAnchors,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration,
                            enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                        )
                        trimDraft = TimelineOverlayGeometry.trimmed(
                            overlay: trimOrigin,
                            edge: edge,
                            translationX: adjusted.translationX,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration,
                            sourceDuration: trimmableSourceDuration
                        )
                        session.setActiveTimelineSnap(adjusted.match)
                    }
                    .onEnded { _ in
                        if let trimDraft { session.commitOverlayEdit(trimDraft) }
                        trimDraft = nil
                        trimOrigin = nil
                        activeTrimEdge = nil
                        snapAnchors = []
                        session.setActiveTimelineSnap(nil)
                    }
            )
            .help(edge == .leading ? "Trim overlay start" : "Extend or trim overlay end")
    }
}

struct TimelineAudioItem: View {
    /// Held, not observed. A cell that subscribes to the session is rebuilt
    /// whenever anything in the editor changes, so typing in one caption used
    /// to re-run the body of every cell on the timeline. Everything the body
    /// draws with arrives as a value, and the reference is here only to call
    /// commands from the gestures below.
    let session: EditorSession
    @ObservedObject var drag: TimelineDragState
    /// Watched, unlike the session: this cell wants to redraw when its own
    /// waveform arrives, and nothing else on the timeline does.
    @ObservedObject var waveforms: AudioWaveformStore
    /// Watched for the same reason: this cell's own fader.
    @ObservedObject var levels: AudioLevelDraft
    let layer: ProjectAudioLayer
    let contentWidth: Double
    /// The project length the cell lays itself out against, passed in so
    /// the cell does not have to watch the session for it.
    let projectDuration: Double
    let rowY: Double
    let selected: Bool
    @State private var trimOrigin: ProjectAudioLayer?
    @State private var trimDraft: ProjectAudioLayer?
    @State private var moveOrigin: ProjectAudioLayer?
    @State private var moveDraft: ProjectAudioLayer?
    @State private var activeTrimEdge: HorizontalEdge?
    @State private var snapAnchors: [TimelineSnapAnchor] = []
    @State private var selectionMoveBounds: (start: Double, end: Double)?
    /// Where the pointer actually is, before snapping pulls the drop onto a
    /// guide. Exactly as the overlay cell does it: the sound rides the pointer
    /// and the orange guide says which anchor it will settle on, because a cell
    /// drawn on the snapped position sticks between anchors instead of moving.
    @State private var freeMoveStart: Double?

    /// Tall enough for a waveform to read inside the audio row.
    static let cellHeight = 46.0
    /// The narrowest a sound is ever drawn.
    ///
    /// Some effects are barely there: the classic click is thirty-nine
    /// milliseconds, which is a third of a point at the default zoom and a
    /// sliver at any zoom the rest of the edit is usable at. Drawn honestly it
    /// is a hairline nobody can see, let alone hit, so a sound shorter than
    /// this is drawn at this and anchored to its own start.
    ///
    /// The left edge is always the truth — that is the moment the sound plays,
    /// and it is what the eye reads a cell's position from. Only the right edge
    /// of a very short sound is a rounding, and a thirty-nine millisecond click
    /// has no meaningful end to be wrong about.
    static let minimumDrawnWidth = 20.0

    var body: some View {
        let displayed = trimDraft ?? moveDraft ?? layer
        let startX = contentWidth
            * (freeMoveStart ?? displayed.timelineStart)
            / max(0.001, projectDuration)
        let trueWidth = max(1, contentWidth * displayed.duration / max(0.001, projectDuration))
        // Never below what can be seen and grabbed: see minimumDrawnWidth.
        let width = max(trueWidth, Self.minimumDrawnWidth)
        let isMoving = moveDraft != nil
        // Not a Button, for the same reason the overlay cell is not: a button
        // holds on to the mouse-down and the drag only reaches the gesture in
        // bursts, so the cell looks stuck until it is let go.
        TimelineAudioCell(
            name: layer.name,
            peaks: waveforms.peaks(for: layer),
            sourceStart: displayed.sourceStart,
            sourceEnd: displayed.sourceStart + displayed.duration,
            fileDuration: max(
                displayed.sourceStart + displayed.duration,
                layer.sourceDuration ?? displayed.duration
            ),
            height: Self.cellHeight,
            selected: selected,
            volume: levels.volume(for: layer.id) ?? layer.volume
        )
        // Inset the drawing, never the layout, exactly as the video and overlay
        // cells do. The trim handles are aligned to the layout box, so without
        // this they sat wholly inside the drawn rectangle — inside the rounded
        // corner, over the waveform — instead of straddling the edge they trim.
        .padding(.horizontal, 1)
        // Leading, and clipped: a cell can only ever be as wide as its sound is
        // long, and anything that will not fit runs off the end rather than
        // pushing the cell off its own moment.
        .frame(width: width, height: Self.cellHeight, alignment: .leading)
        .clipped()
        .contentShape(Rectangle())
        .task(id: layer.url) { await waveforms.load(for: layer) }
        .onTapGesture { selectTimelineItemFromPointer(.audio(layer.id), session: session) }
        // The cell on the timeline is where you are looking at the sound when
        // you decide it is the wrong one.
        .contextMenu {
            Menu {
                SoundSwapMenu(session: session, layer: layer)
            } label: {
                Label("Replace", systemImage: "arrow.2.squarepath")
            }
            Divider()
            Button(role: .destructive) {
                session.selectedAudioLayerID = layer.id
                Task { await session.deleteSelectedAudioLayer() }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        // Picked up: it lifts off the lane and says where it is, because one
        // second of the audio track looks like every other second of it.
        .opacity(isMoving ? 0.72 : 1)
        .scaleEffect(isMoving ? 1.02 : 1, anchor: .center)
        .shadow(
            color: .black.opacity(isMoving ? 0.55 : 0),
            radius: isMoving ? 10 : 0,
            y: isMoving ? 5 : 0
        )
        .overlay(alignment: .top) {
            if isMoving {
                Text(TimelineDropInsertionLine.clock(displayed.timelineStart))
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5)
                    .frame(height: 15)
                    .background(Color.yapperOrange)
                    .clipShape(Capsule(style: .continuous))
                    .fixedSize()
                    .offset(y: -18)
            }
        }
        .animation(.easeOut(duration: 0.12), value: isMoving)
        .gesture(
            DragGesture(
                minimumDistance: 2,
                coordinateSpace: .named(TimelineContent.coordinateSpaceName)
            )
                .onChanged { value in
                    guard activeTrimEdge == nil else { return }
                    if moveOrigin == nil, selectionMoveBounds == nil {
                        session.ensureTimelineItemSelected(.audio(layer.id))
                        snapAnchors = session.timelineSnapAnchors(carrying: .audio(layer.id))
                        session.beginTimelineDrag(layer.id)
                        if session.timelineSelection.count > 1 {
                            selectionMoveBounds = session.timelineSelectionBounds()
                        } else {
                            moveOrigin = layer
                        }
                    }
                    // Escape gives the sound back to where it came from, the
                    // same as it does for an overlay.
                    guard !session.isTimelineDragCancelled else {
                        moveDraft = nil
                        freeMoveStart = nil
                        return
                    }
                    if let selectionMoveBounds {
                        let move = timelineSelectionMove(
                            session: session,
                            bounds: selectionMoveBounds,
                            rawTranslationX: value.location.x - value.startLocation.x,
                            contentWidth: contentWidth,
                            snapAnchors: snapAnchors
                        )
                        session.previewTimelineSelectionMove(delta: move.delta)
                        session.setActiveTimelineSnap(move.match)
                        return
                    }
                    guard let moveOrigin else { return }
                    let rawTranslation = value.location.x - value.startLocation.x
                    let rawDraft = TimelineAudioGeometry.moved(
                        layer: moveOrigin,
                        translationX: rawTranslation,
                        contentWidth: contentWidth,
                        projectDuration: projectDuration
                    )
                    let adjusted = TimelineSnapDragGeometry.moveTranslation(
                        originalStart: moveOrigin.timelineStart,
                        proposedStart: rawDraft.timelineStart,
                        duration: rawDraft.duration,
                        rawTranslationX: rawTranslation,
                        anchors: snapAnchors,
                        contentWidth: contentWidth,
                        projectDuration: projectDuration,
                        enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                    )
                    moveDraft = TimelineAudioGeometry.moved(
                        layer: moveOrigin,
                        translationX: adjusted.translationX,
                        contentWidth: contentWidth,
                        projectDuration: projectDuration
                    )
                    // Pulled onto the snap while one is in reach, so lining a
                    // sound up with a clip edge, a sound or the playhead can
                    // be felt and not only seen. Nothing is forced: the pull
                    // reaches exactly as far as the snap threshold, Option
                    // turns it off, and an item no longer sticks to its own
                    // edges — see `timelineSnapAnchors(carrying:)`.
                    freeMoveStart = adjusted.match == nil
                        ? rawDraft.timelineStart
                        : moveDraft?.timelineStart ?? rawDraft.timelineStart
                    session.setActiveTimelineSnap(adjusted.match)
                }
                .onEnded { _ in
                    let wasCancelled = session.isTimelineDragCancelled
                    session.endTimelineDrag()
                    if wasCancelled {
                        moveDraft = nil
                        moveOrigin = nil
                        freeMoveStart = nil
                        selectionMoveBounds = nil
                        snapAnchors = []
                        session.cancelTimelineSelectionMove()
                        session.setActiveTimelineSnap(nil)
                        return
                    }
                    if selectionMoveBounds != nil {
                        selectionMoveBounds = nil
                        snapAnchors = []
                        session.setActiveTimelineSnap(nil)
                        Task { await session.commitTimelineSelectionMove() }
                        return
                    }
                    let committedMove = moveDraft
                    moveDraft = nil
                    moveOrigin = nil
                    freeMoveStart = nil
                    snapAnchors = []
                    session.setActiveTimelineSnap(nil)
                    guard let committedMove else { return }
                    Task { await session.commitAudioTrim(committedMove) }
                }
        )
        .overlay(alignment: .leading) {
            if selected { trimHandle(.leading) }
        }
        .overlay(alignment: .trailing) {
            if selected { trimHandle(.trailing) }
        }
        .offset(
            x: startX + (selected
                ? TimelineTrimGeometry.x(
                    for: drag.offset,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                : 0),
            y: rowY
        )
    }

    private func trimHandle(_ edge: HorizontalEdge) -> some View {
        let displayed = trimDraft ?? layer
        let edgeTime = edge == .leading
            ? displayed.timelineStart
            : displayed.timelineStart + displayed.duration
        return TimelineTrimHandle(
            edge: edge,
            height: 42,
            isActive: activeTrimEdge == edge,
            readout: activeTrimEdge == edge ? formatTimelineTrimTime(edgeTime) : nil
        )
            .highPriorityGesture(
                DragGesture(
                    minimumDistance: 0,
                    coordinateSpace: .named(TimelineContent.coordinateSpaceName)
                )
                    .onChanged { value in
                        if trimOrigin == nil {
                            trimOrigin = layer
                            activeTrimEdge = edge
                            snapAnchors = session.timelineSnapAnchors(carrying: .audio(layer.id))
                            session.ensureTimelineItemSelected(.audio(layer.id))
                        }
                        guard let trimOrigin else { return }
                        let rawTranslation = value.location.x - value.startLocation.x
                        let rawDraft = TimelineAudioGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: rawTranslation,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration
                        )
                        let originalEdgeTime = edge == .leading
                            ? trimOrigin.timelineStart
                            : trimOrigin.timelineStart + trimOrigin.duration
                        let proposedEdgeTime = edge == .leading
                            ? rawDraft.timelineStart
                            : rawDraft.timelineStart + rawDraft.duration
                        let adjusted = TimelineSnapDragGeometry.trimTranslation(
                            originalEdgeTime: originalEdgeTime,
                            proposedEdgeTime: proposedEdgeTime,
                            rawTranslationX: rawTranslation,
                            anchors: snapAnchors,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration,
                            enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                        )
                        trimDraft = TimelineAudioGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: adjusted.translationX,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration
                        )
                        session.setActiveTimelineSnap(adjusted.match)
                    }
                    .onEnded { _ in
                        let committedTrim = trimDraft
                        trimDraft = nil
                        trimOrigin = nil
                        activeTrimEdge = nil
                        snapAnchors = []
                        session.setActiveTimelineSnap(nil)
                        guard let committedTrim else { return }
                        Task {
                            await session.commitAudioTrim(committedTrim)
                        }
                    }
            )
            .help(edge == .leading ? "Extend or trim audio start" : "Extend or trim audio end")
    }
}

enum TimelineOverlayGeometry {
    static func moved(
        overlay: ProjectOverlay,
        translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double
    ) -> ProjectOverlay {
        var updated = overlay
        guard projectDuration > 0, contentWidth > 0 else { return updated }
        let delta = TimelineTrimGeometry.timeDelta(
            for: translationX,
            contentWidth: contentWidth,
            projectDuration: projectDuration
        )
        updated.timelineStart = min(
            max(0, projectDuration - overlay.duration),
            max(0, overlay.timelineStart + delta)
        )
        return updated
    }

    /// - Parameter sourceDuration: how much footage there is behind the cell.
    ///   `nil` for a still, which has no in point to move and can be held on
    ///   screen for as long as anyone likes.
    static func trimmed(
        overlay: ProjectOverlay,
        edge: HorizontalEdge,
        translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double,
        sourceDuration: Double? = nil
    ) -> ProjectOverlay {
        var updated = overlay
        guard projectDuration > 0, contentWidth > 0 else { return updated }
        let delta = TimelineTrimGeometry.timeDelta(
            for: translationX,
            contentWidth: contentWidth,
            projectDuration: projectDuration
        )
        let minimumDuration = min(0.2, max(0.02, projectDuration))

        guard let sourceDuration, sourceDuration > 0 else {
            // A still shows the same picture whenever it is played, so its
            // edges only decide how long it is up.
            switch edge {
            case .leading:
                let end = overlay.timelineStart + overlay.duration
                updated.timelineStart = min(
                    end - minimumDuration,
                    max(0, overlay.timelineStart + delta)
                )
                updated.duration = end - updated.timelineStart
                updated = OverlayKeyTrack.rebased(updated, by: updated.timelineStart - overlay.timelineStart)
            case .trailing:
                updated.duration = min(
                    max(minimumDuration, overlay.duration + delta),
                    max(minimumDuration, projectDuration - overlay.timelineStart)
                )
            }
            return updated
        }

        // Footage saved before this was source-aware can already claim more
        // than the file holds; that is what it is showing, so it is the floor.
        let available = max(sourceDuration, overlay.sourceStart + overlay.duration)
        switch edge {
        case .leading:
            // Dragging the left edge moves the in point with it, so the cell
            // loses its opening rather than starting the same footage later.
            let sourceEnd = overlay.sourceStart + overlay.duration
            // Neither past the head of the footage nor off the front of the
            // video: whichever runs out first stops the drag.
            let earliest = max(0, overlay.sourceStart - overlay.timelineStart)
            let newSourceStart = min(
                sourceEnd - minimumDuration,
                max(earliest, overlay.sourceStart + delta)
            )
            updated.sourceStart = newSourceStart
            updated.timelineStart = max(
                0,
                overlay.timelineStart + (newSourceStart - overlay.sourceStart)
            )
            updated.duration = sourceEnd - newSourceStart
            updated = OverlayKeyTrack.rebased(updated, by: updated.timelineStart - overlay.timelineStart)
        case .trailing:
            let sourceEnd = min(
                available,
                max(
                    overlay.sourceStart + minimumDuration,
                    overlay.sourceStart + overlay.duration + delta
                )
            )
            updated.duration = min(
                sourceEnd - overlay.sourceStart,
                max(minimumDuration, projectDuration - overlay.timelineStart)
            )
        }
        return updated
    }
}

enum TimelineAudioGeometry {
    static func moved(
        layer: ProjectAudioLayer,
        translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double
    ) -> ProjectAudioLayer {
        var updated = layer
        guard projectDuration > 0, contentWidth > 0 else { return updated }
        let delta = TimelineTrimGeometry.timeDelta(
            for: translationX,
            contentWidth: contentWidth,
            projectDuration: projectDuration
        )
        updated.timelineStart = min(
            max(0, projectDuration - layer.duration),
            max(0, layer.timelineStart + delta)
        )
        return updated
    }

    static func trimmed(
        layer: ProjectAudioLayer,
        edge: HorizontalEdge,
        translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double
    ) -> ProjectAudioLayer {
        var updated = layer
        guard projectDuration > 0, contentWidth > 0 else { return updated }
        let delta = TimelineTrimGeometry.timeDelta(
            for: translationX,
            contentWidth: contentWidth,
            projectDuration: projectDuration
        )
        let minimumDuration = min(0.05, max(0.01, projectDuration))
        let sourceDuration = max(
            layer.sourceStart + layer.duration,
            layer.sourceDuration ?? 0
        )
        switch edge {
        case .leading:
            let sourceEnd = layer.sourceStart + layer.duration
            let earliestSourceStart = max(0, layer.sourceStart - layer.timelineStart)
            let newSourceStart = min(
                sourceEnd - minimumDuration,
                max(earliestSourceStart, layer.sourceStart + delta)
            )
            let actualDelta = newSourceStart - layer.sourceStart
            updated.sourceStart = newSourceStart
            updated.timelineStart = max(0, layer.timelineStart + actualDelta)
            updated.duration = sourceEnd - newSourceStart
        case .trailing:
            let sourceEnd = min(
                sourceDuration,
                max(layer.sourceStart + minimumDuration, layer.sourceStart + layer.duration + delta)
            )
            updated.duration = min(
                sourceEnd - layer.sourceStart,
                max(minimumDuration, projectDuration - layer.timelineStart)
            )
        }
        return updated
    }
}

private struct TimelineTextLayerCell: View {
    /// Held, not observed. A cell that subscribes to the session is rebuilt
    /// whenever anything in the editor changes, so typing in one caption used
    /// to re-run the body of every cell on the timeline. Everything the body
    /// draws with arrives as a value, and the reference is here only to call
    /// commands from the gestures below.
    let session: EditorSession
    @ObservedObject var drag: TimelineDragState
    let layer: ProjectTextLayer
    let contentWidth: Double
    /// The project length the cell lays itself out against, passed in so
    /// the cell does not have to watch the session for it.
    let projectDuration: Double
    let rowY: Double
    let selected: Bool
    @State private var trimOrigin: ProjectTextLayer?
    @State private var trimDraft: ProjectTextLayer?
    @State private var moveOrigin: ProjectTextLayer?
    @State private var moveDraft: ProjectTextLayer?
    @State private var activeTrimEdge: HorizontalEdge?
    @State private var snapAnchors: [TimelineSnapAnchor] = []
    @State private var selectionMoveBounds: (start: Double, end: Double)?

    var body: some View {
        let displayed = trimDraft ?? moveDraft ?? layer
        let startX = contentWidth * displayed.timelineStart / max(0.001, projectDuration)
        let width = max(1, contentWidth * displayed.duration / max(0.001, projectDuration))
        RoundedRectangle(cornerRadius: 5, style: .continuous)
            .fill(Color(red: 0.42, green: 0.20, blue: 0.12).opacity(0.88))
            .overlay(alignment: .leading) {
                HStack(spacing: 5) {
                    Image(systemName: "textformat")
                    Text(displayed.text.isEmpty ? "Text" : displayed.text).lineLimit(1)
                }
                .font(.studioCaptionStrong)
                .foregroundStyle(Color.white.opacity(0.95))
                .padding(.horizontal, selected ? 11 : 7)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .stroke(
                        selected ? Color.yapperOrange.opacity(0.92) : Color.secondary.opacity(0.42),
                        lineWidth: selected ? 1.15 : 0.7
                    )
            }
            .contentShape(Rectangle())
            .onTapGesture { selectTimelineItemFromPointer(.text(displayed.id), session: session) }
            .contextMenu {
                PropertiesMenuItems(session: session, item: .text(displayed.id))
            }
            .frame(width: width, height: 42)
            .clipped()
            .gesture(
                DragGesture(
                    minimumDistance: 2,
                    coordinateSpace: .named(TimelineContent.coordinateSpaceName)
                )
                    .onChanged { value in
                        guard activeTrimEdge == nil else { return }
                        if moveOrigin == nil, selectionMoveBounds == nil {
                            session.ensureTimelineItemSelected(.text(layer.id))
                            snapAnchors = session.timelineSnapAnchors(carrying: .text(layer.id))
                            if session.timelineSelection.count > 1 {
                                selectionMoveBounds = session.timelineSelectionBounds()
                            } else {
                                moveOrigin = layer
                            }
                        }
                        if let selectionMoveBounds {
                            let move = timelineSelectionMove(
                                session: session,
                                bounds: selectionMoveBounds,
                                rawTranslationX: value.location.x - value.startLocation.x,
                                contentWidth: contentWidth,
                                snapAnchors: snapAnchors
                            )
                            session.previewTimelineSelectionMove(delta: move.delta)
                            session.setActiveTimelineSnap(move.match)
                            return
                        }
                        guard let moveOrigin else { return }
                        let rawTranslation = value.location.x - value.startLocation.x
                        let rawDraft = TimelineTextGeometry.moved(
                            layer: moveOrigin,
                            translationX: rawTranslation,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration
                        )
                        let adjusted = TimelineSnapDragGeometry.moveTranslation(
                            originalStart: moveOrigin.timelineStart,
                            proposedStart: rawDraft.timelineStart,
                            duration: rawDraft.duration,
                            rawTranslationX: rawTranslation,
                            anchors: snapAnchors,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration,
                            enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                        )
                        moveDraft = TimelineTextGeometry.moved(
                            layer: moveOrigin,
                            translationX: adjusted.translationX,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration
                        )
                        session.setActiveTimelineSnap(adjusted.match)
                    }
                    .onEnded { _ in
                        if selectionMoveBounds != nil {
                            selectionMoveBounds = nil
                            snapAnchors = []
                            session.setActiveTimelineSnap(nil)
                            Task { await session.commitTimelineSelectionMove() }
                            return
                        }
                        if let moveDraft { session.updateTextLayer(moveDraft) }
                        moveDraft = nil
                        moveOrigin = nil
                        snapAnchors = []
                        session.setActiveTimelineSnap(nil)
                    }
            )
            .overlay(alignment: .leading) {
                if selected { trimHandle(edge: .leading) }
            }
            .overlay(alignment: .trailing) {
                if selected { trimHandle(edge: .trailing) }
            }
            .offset(
                x: startX + (selected
                    ? TimelineTrimGeometry.x(
                        for: drag.offset,
                        contentWidth: contentWidth,
                        projectDuration: projectDuration
                    )
                    : 0),
                y: rowY
            )
    }

    private func trimHandle(edge: HorizontalEdge) -> some View {
        let displayed = trimDraft ?? layer
        let edgeTime = edge == .leading
            ? displayed.timelineStart
            : displayed.timelineStart + displayed.duration
        return TimelineTrimHandle(
            edge: edge,
            height: 38,
            isActive: activeTrimEdge == edge,
            readout: activeTrimEdge == edge ? formatTimelineTrimTime(edgeTime) : nil
        )
            .highPriorityGesture(
                DragGesture(
                    minimumDistance: 0,
                    coordinateSpace: .named(TimelineContent.coordinateSpaceName)
                )
                    .onChanged { value in
                        if trimOrigin == nil {
                            trimOrigin = layer
                            activeTrimEdge = edge
                            snapAnchors = session.timelineSnapAnchors(carrying: .text(layer.id))
                            session.ensureTimelineItemSelected(.text(layer.id))
                        }
                        guard let trimOrigin else { return }
                        let rawTranslation = value.location.x - value.startLocation.x
                        let rawDraft = TimelineTextGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: rawTranslation,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration
                        )
                        let originalEdgeTime = edge == .leading
                            ? trimOrigin.timelineStart
                            : trimOrigin.timelineStart + trimOrigin.duration
                        let proposedEdgeTime = edge == .leading
                            ? rawDraft.timelineStart
                            : rawDraft.timelineStart + rawDraft.duration
                        let adjusted = TimelineSnapDragGeometry.trimTranslation(
                            originalEdgeTime: originalEdgeTime,
                            proposedEdgeTime: proposedEdgeTime,
                            rawTranslationX: rawTranslation,
                            anchors: snapAnchors,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration,
                            enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                        )
                        trimDraft = TimelineTextGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: adjusted.translationX,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration
                        )
                        session.setActiveTimelineSnap(adjusted.match)
                    }
                    .onEnded { _ in
                        if let trimDraft { session.updateTextLayer(trimDraft) }
                        trimDraft = nil
                        trimOrigin = nil
                        activeTrimEdge = nil
                        snapAnchors = []
                        session.setActiveTimelineSnap(nil)
                    }
            )
            .help(edge == .leading ? "Trim text start" : "Extend or trim text end")
    }
}

enum TimelineTextGeometry {
    static func moved(
        layer: ProjectTextLayer,
        translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double
    ) -> ProjectTextLayer {
        var updated = layer
        guard projectDuration > 0, contentWidth > 0 else { return updated }
        let delta = TimelineTrimGeometry.timeDelta(
            for: translationX,
            contentWidth: contentWidth,
            projectDuration: projectDuration
        )
        updated.timelineStart = min(
            max(0, projectDuration - layer.duration),
            max(0, layer.timelineStart + delta)
        )
        return updated
    }

    static func trimmed(
        layer: ProjectTextLayer,
        edge: HorizontalEdge,
        translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double
    ) -> ProjectTextLayer {
        var updated = layer
        guard projectDuration > 0, contentWidth > 0 else { return updated }
        let delta = TimelineTrimGeometry.timeDelta(
            for: translationX,
            contentWidth: contentWidth,
            projectDuration: projectDuration
        )
        let minimumDuration = min(0.2, max(0.02, projectDuration))
        switch edge {
        case .leading:
            let originalEnd = layer.timelineStart + layer.duration
            let start = min(
                originalEnd - minimumDuration,
                max(0, layer.timelineStart + delta)
            )
            updated.timelineStart = start
            updated.duration = originalEnd - start
        case .trailing:
            updated.duration = min(
                max(minimumDuration, layer.duration + delta),
                max(minimumDuration, projectDuration - layer.timelineStart)
            )
        }
        return updated
    }
}

struct TimelineRuler: View {
    let duration: Double
    let width: Double
    /// The stretch of the strip to draw, in points. See `TimelineRulerTicks`:
    /// the strip is as wide as the zoomed timeline, and drawing all of it costs
    /// the same whether or not any of it is on screen.
    let visible: ClosedRange<Double>

    var body: some View {
        Canvas { context, size in
            let ticks = TimelineRulerTicks.ticks(
                duration: duration,
                width: size.width,
                visible: visible
            )
            for tick in ticks {
                let x = TimelineMetrics.x(for: tick.time, duration: duration, width: size.width)
                var path = Path()
                path.move(to: CGPoint(x: x, y: tick.isMajor ? 18 : 25))
                path.addLine(to: CGPoint(x: x, y: 30))
                context.stroke(
                    path,
                    with: .color(Color.primary.opacity(tick.isMajor ? 0.32 : 0.14)),
                    lineWidth: 1
                )
                if tick.isMajor {
                    context.draw(
                        Text(formatTime(tick.time))
                            .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                            .foregroundStyle(Color.primary.opacity(0.84)),
                        // Keep the ascenders inside the Canvas at every display
                        // scale; the old baseline could clip the time labels.
                        at: CGPoint(x: x + 3, y: 13),
                        anchor: .leading
                    )
                }
            }
        }
        // A drawing of the timeline, not a control. See TimelineThumbnailStrip.
        .accessibilityHidden(true)
    }
}

struct WaveformShape: View {
    let peaks: [Float]
    let sampleRange: Range<Int>
    let color: Color
    /// How loud this is playing. The bars are drawn at the height the mix will
    /// actually give them, so pulling a fader down is something you can see on
    /// the timeline rather than something you have to remember.
    var gain: Double = 1

    var body: some View {
        Canvas { context, size in
            // One path, one fill. Filling each bar separately meant a thousand
            // fills across a timeline for every frame of a resize or a zoom.
            var path = Path()
            for rect in WaveformBars.rects(
                peaks: peaks,
                sampleRange: sampleRange,
                size: size,
                gain: gain
            ) {
                path.addRoundedRect(
                    in: rect,
                    cornerSize: CGSize(width: WaveformBars.cornerRadius, height: WaveformBars.cornerRadius)
                )
            }
            guard !path.isEmpty else { return }
            context.fill(path, with: .color(color))
        }
        // A drawing of the sound, not a control. See TimelineThumbnailStrip.
        .accessibilityHidden(true)
    }
}
