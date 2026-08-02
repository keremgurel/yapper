@preconcurrency import AppKit
import CoreGraphics
import SwiftUI

struct TimelinePanel: View {
    @ObservedObject var session: EditorSession
    @State private var pointsPerSecond = 36.0
    private let leadingTimelineInset = 84.0
    private let trailingTimelineInset = 160.0

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
                    Label("Magnet", systemImage: "magnet")
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
                .buttonStyle(.plain)
                .help("Snap to the playhead, edges, seconds, and audio transients · hold Option to bypass")
                Divider()
                    .frame(height: 18)
                Button {
                    Task { await session.splitAtPlayhead() }
                } label: {
                    Image(systemName: "scissors")
                        .frame(width: 28, height: 26)
                        .contentShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(session.project.clips.isEmpty)
                .help("Split selected item at playhead · S")
                Button {
                    Task { await session.deleteTimelineSelection() }
                } label: {
                    Image(systemName: "trash")
                        .frame(width: 28, height: 26)
                        .contentShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(!session.hasTimelineSelection)
                .help("Delete selected timeline items · Delete")
                Button {
                    Task { await session.autoTrimSilences() }
                } label: {
                    Image(systemName: "waveform")
                        .frame(width: 28, height: 26)
                        .contentShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(session.project.clips.isEmpty || session.isAIEditing)
                .help("Auto-trim silent gaps · ⇧⌘T")
                Spacer()
                Image(systemName: "minus.magnifyingglass")
                    .foregroundStyle(.secondary)
                Slider(value: $pointsPerSecond, in: TimelineZoomGeometry.scaleRange)
                    .frame(width: 130)
                    .controlSize(.mini)
                    .help("Pinch or ⌘-scroll over the timeline to zoom")
                Image(systemName: "plus.magnifyingglass")
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 14)
            .frame(height: 38)
            .background(Color.panelBackground)

            GeometryReader { proxy in
                let timelineViewportWidth = max(1, proxy.size.width - 71)
                let minimumTimelineWidth = max(
                    280,
                    min(520, timelineViewportWidth * 0.52)
                )
                let contentWidth = max(minimumTimelineWidth, session.duration * pointsPerSecond)
                let contentHeight = max(540, proxy.size.height + 168)
                ScrollView(.vertical, showsIndicators: true) {
                    HStack(spacing: 0) {
                        TrackHeader(hasText: true, hasOverlays: true, hasAudio: true)
                        .frame(width: 70)
                        Rectangle().fill(Color.studioLine).frame(width: 1)
                        ScrollView(.horizontal, showsIndicators: true) {
                            TimelineContent(
                                session: session,
                                contentWidth: contentWidth
                            )
                            .frame(width: contentWidth, height: contentHeight)
                            .padding(.leading, leadingTimelineInset)
                            .padding(.trailing, trailingTimelineInset)
                            .background {
                                TimelineZoomInputView(
                                    leadingInset: leadingTimelineInset,
                                    trailingInset: trailingTimelineInset,
                                    timelineWidth: contentWidth
                                ) { factor in
                                    applyZoom(
                                        factor,
                                        minimumTimelineWidth: minimumTimelineWidth
                                    )
                                }
                            }
                        }
                    }
                    .frame(height: contentHeight)
                }
            }
        }
        .background {
            ZStack {
                Color.editorBackground
                TimelineKeyboardInputView { command in
                    performKeyboardCommand(command)
                }
            }
        }
        .overlay(alignment: .top) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }

    private func applyZoom(_ factor: Double, minimumTimelineWidth: Double) -> Double {
        let previous = pointsPerSecond
        let updated = TimelineZoomGeometry.scaled(previous, by: factor)
        let previousWidth = max(minimumTimelineWidth, session.duration * previous)
        guard abs(updated - previous) > 0.0001 else { return previousWidth }
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            pointsPerSecond = updated
        }
        return max(minimumTimelineWidth, session.duration * updated)
    }

    private func performKeyboardCommand(_ command: TimelineKeyboardCommand) {
        switch command {
        case .split:
            Task { await session.splitAtPlayhead() }
        case .delete:
            Task { await session.deleteTimelineSelection() }
        case .trimLeading:
            Task { await session.trimTimelineSelection(toPlayhead: .leading) }
        case .trimTrailing:
            Task { await session.trimTimelineSelection(toPlayhead: .trailing) }
        }
    }
}

private enum TimelineKeyboardCommand {
    case split
    case delete
    case trimLeading
    case trimTrailing
}

private final class TimelineKeyboardMonitorView: NSView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}

private struct TimelineKeyboardInputView: NSViewRepresentable {
    let onCommand: (TimelineKeyboardCommand) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onCommand: onCommand)
    }

    func makeNSView(context: Context) -> TimelineKeyboardMonitorView {
        let view = TimelineKeyboardMonitorView()
        context.coordinator.view = view
        context.coordinator.install()
        return view
    }

    func updateNSView(_ nsView: TimelineKeyboardMonitorView, context: Context) {
        context.coordinator.view = nsView
        context.coordinator.onCommand = onCommand
    }

    static func dismantleNSView(_ nsView: TimelineKeyboardMonitorView, coordinator: Coordinator) {
        coordinator.uninstall()
    }

    @MainActor
    final class Coordinator {
        weak var view: TimelineKeyboardMonitorView?
        var onCommand: (TimelineKeyboardCommand) -> Void
        private var monitor: Any?

        init(onCommand: @escaping (TimelineKeyboardCommand) -> Void) {
            self.onCommand = onCommand
        }

        func install() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
                self?.handle(event) ?? event
            }
        }

        func uninstall() {
            guard let monitor else { return }
            NSEvent.removeMonitor(monitor)
            self.monitor = nil
        }

        private func handle(_ event: NSEvent) -> NSEvent? {
            guard let view, let window = view.window, event.window === window else { return event }
            if window.firstResponder is NSTextView || window.firstResponder is NSTextField {
                return event
            }
            let disallowedModifiers: NSEvent.ModifierFlags = [.command, .control, .option, .shift]
            guard event.modifierFlags.intersection(disallowedModifiers).isEmpty else { return event }

            let command: TimelineKeyboardCommand?
            if event.keyCode == 51 || event.keyCode == 117 {
                command = .delete
            } else {
                switch event.charactersIgnoringModifiers?.lowercased() {
                case "s": command = .split
                case "[": command = .trimLeading
                case "]": command = .trimTrailing
                default: command = nil
                }
            }
            guard let command else { return event }
            onCommand(command)
            return nil
        }
    }
}

private var isTimelineSnapTemporarilyBypassed: Bool {
    NSEvent.modifierFlags.contains(.option)
}

@MainActor
private func selectTimelineItemFromPointer(
    _ item: TimelineSelectionItem,
    session: EditorSession
) {
    let flags = NSEvent.modifierFlags
    session.selectTimelineItem(
        item,
        additive: flags.contains(.shift),
        toggling: flags.contains(.command)
    )
}

@MainActor
private func timelineSelectionMove(
    session: EditorSession,
    bounds: (start: Double, end: Double),
    rawTranslationX: CGFloat,
    contentWidth: Double,
    snapAnchors: [TimelineSnapAnchor]
) -> (delta: Double, match: TimelineSnapMatch?) {
    let rawDelta = TimelineTrimGeometry.timeDelta(
        for: rawTranslationX,
        contentWidth: contentWidth,
        projectDuration: session.duration
    )
    guard session.isTimelineSnappingEnabled,
          !isTimelineSnapTemporarilyBypassed,
          let snapped = TimelineSnapEngine.movingMatch(
            start: bounds.start + rawDelta,
            duration: bounds.end - bounds.start,
            anchors: snapAnchors,
            contentWidth: contentWidth,
            projectDuration: session.duration
          ) else { return (rawDelta, nil) }
    return (snapped.start - bounds.start, snapped.match)
}

enum TimelineZoomGeometry {
    static let scaleRange = 1.25 ... 320.0

    static func scrollFactor(delta: CGFloat, hasPreciseDeltas: Bool) -> Double {
        // Trackpads emit many small deltas. Keeping the curve shallow makes the
        // timeline stay visually pinned beneath the pointer instead of pulsing
        // several frames in and out for one physical gesture.
        let sensitivity = hasPreciseDeltas ? 0.002 : 0.024
        return min(1.08, max(0.925, exp(Double(delta) * sensitivity)))
    }

    static func scaled(_ current: Double, by factor: Double) -> Double {
        min(scaleRange.upperBound, max(scaleRange.lowerBound, current * factor))
    }

    static func anchoredOffset(
        oldOffset: CGFloat,
        pointerX: CGFloat,
        oldContentWidth: CGFloat,
        newContentWidth: CGFloat,
        viewportWidth: CGFloat,
        leadingInset: CGFloat = 0,
        trailingInset: CGFloat = 0
    ) -> CGFloat {
        guard oldContentWidth > 0, newContentWidth > 0 else { return 0 }
        let documentX = oldOffset + pointerX
        let timelineX = documentX - leadingInset
        let fraction = min(1, max(0, timelineX / oldContentWidth))
        let proposed = leadingInset + fraction * newContentWidth - pointerX
        let documentWidth = leadingInset + newContentWidth + trailingInset
        return min(max(0, documentWidth - viewportWidth), max(0, proposed))
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

private final class TimelineZoomMonitorView: NSView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}

private struct TimelineZoomInputView: NSViewRepresentable {
    let leadingInset: CGFloat
    let trailingInset: CGFloat
    let timelineWidth: CGFloat
    let onZoom: (Double) -> Double

    func makeCoordinator() -> Coordinator {
        Coordinator(
            leadingInset: leadingInset,
            trailingInset: trailingInset,
            timelineWidth: timelineWidth,
            onZoom: onZoom
        )
    }

    func makeNSView(context: Context) -> TimelineZoomMonitorView {
        let view = TimelineZoomMonitorView()
        context.coordinator.view = view
        context.coordinator.install()
        return view
    }

    func updateNSView(_ nsView: TimelineZoomMonitorView, context: Context) {
        context.coordinator.view = nsView
        context.coordinator.leadingInset = leadingInset
        context.coordinator.trailingInset = trailingInset
        context.coordinator.timelineWidth = timelineWidth
        context.coordinator.onZoom = onZoom
        context.coordinator.synchronizeZoomLayout()
    }

    static func dismantleNSView(_ nsView: TimelineZoomMonitorView, coordinator: Coordinator) {
        coordinator.uninstall()
    }

    @MainActor
    final class Coordinator {
        weak var view: TimelineZoomMonitorView?
        var leadingInset: CGFloat
        var trailingInset: CGFloat
        var timelineWidth: CGFloat
        var onZoom: (Double) -> Double
        private var monitor: Any?
        private var zoomGeneration = 0
        private var pendingZoomGeneration: Int?
        private var virtualTimelineWidth: CGFloat?
        private var virtualScrollOffset: CGFloat?
        private var pendingTargetX: CGFloat?
        private var pendingDocumentWidth: CGFloat?
        private var commandScrollSequenceActive = false

        init(
            leadingInset: CGFloat,
            trailingInset: CGFloat,
            timelineWidth: CGFloat,
            onZoom: @escaping (Double) -> Double
        ) {
            self.leadingInset = leadingInset
            self.trailingInset = trailingInset
            self.timelineWidth = timelineWidth
            self.onZoom = onZoom
        }

        func install() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(matching: [.scrollWheel, .magnify]) { [weak self] event in
                self?.handle(event) ?? event
            }
        }

        func uninstall() {
            guard let monitor else { return }
            NSEvent.removeMonitor(monitor)
            self.monitor = nil
        }

        private func handle(_ event: NSEvent) -> NSEvent? {
            guard
                let view,
                let window = view.window,
                event.window === window
            else { return event }

            let scrollViews = enclosingScrollViews(from: view)
            guard let scrollView = scrollViews.first else { return event }
            // The zoom monitor lives inside the horizontal scroller, which is
            // itself nested in the vertically scrollable track container. Use
            // the outermost frame for hit testing so Command-scroll is owned
            // by zoom everywhere in the timeline, including track headers and
            // empty track space—not only directly above a clip.
            let timelineContainer = scrollViews.last ?? scrollView
            let interactiveFrame = timelineContainer.convert(timelineContainer.bounds, to: nil)
            guard interactiveFrame.contains(event.locationInWindow) else { return event }

            let requestedFactor: Double
            switch event.type {
            case .magnify:
                requestedFactor = min(1.18, max(0.84, 1 + Double(event.magnification)))
            case .scrollWheel where isCommandZoomEvent(event):
                let dominantDelta = abs(event.scrollingDeltaY) >= abs(event.scrollingDeltaX)
                    ? event.scrollingDeltaY
                    : event.scrollingDeltaX
                requestedFactor = TimelineZoomGeometry.scrollFactor(
                    delta: dominantDelta,
                    hasPreciseDeltas: event.hasPreciseScrollingDeltas
                )
            default:
                return event
            }

            let clipView = scrollView.contentView
            let actualOffset = clipView.bounds.minX
            if pendingZoomGeneration == nil {
                virtualTimelineWidth = timelineWidth
                virtualScrollOffset = actualOffset
            }
            let pointerInClip = clipView.convert(event.locationInWindow, from: nil)
            let pointerX = min(
                clipView.bounds.width,
                max(0, pointerInClip.x - actualOffset)
            )
            let oldTimelineWidth = virtualTimelineWidth ?? timelineWidth
            let oldOffset = virtualScrollOffset ?? actualOffset
            let newTimelineWidth = onZoom(requestedFactor)
            guard abs(newTimelineWidth - oldTimelineWidth) > 0.0001 else { return nil }
            timelineWidth = newTimelineWidth
            virtualTimelineWidth = newTimelineWidth
            zoomGeneration += 1
            let generation = zoomGeneration

            let targetX = TimelineZoomGeometry.anchoredOffset(
                oldOffset: oldOffset,
                pointerX: pointerX,
                oldContentWidth: oldTimelineWidth,
                newContentWidth: newTimelineWidth,
                viewportWidth: clipView.bounds.width,
                leadingInset: leadingInset,
                trailingInset: trailingInset
            )
            virtualScrollOffset = targetX
            pendingZoomGeneration = generation
            pendingTargetX = targetX
            pendingDocumentWidth = leadingInset + newTimelineWidth + trailingInset
            // updateNSView applies this during the same SwiftUI layout pass as
            // the new content width. This prevents a visible frame where the
            // clips resize around the left edge before the scroll anchor moves.
            DispatchQueue.main.async { [weak self] in
                self?.synchronizeZoomLayout()
            }
            return nil
        }

        func synchronizeZoomLayout() {
            guard
                pendingZoomGeneration != nil,
                let view,
                let scrollView = enclosingScrollViews(from: view).first,
                let targetX = pendingTargetX,
                let expectedDocumentWidth = pendingDocumentWidth
            else { return }

            scrollView.documentView?.layoutSubtreeIfNeeded()
            let actualDocumentWidth = scrollView.documentView?.bounds.width ?? 0
            guard abs(actualDocumentWidth - expectedDocumentWidth) <= 1.5 else { return }

            let clipView = scrollView.contentView
            let maximumOffset = max(0, actualDocumentWidth - clipView.bounds.width)
            let resolvedOffset = min(maximumOffset, max(0, targetX))
            clipView.scroll(to: CGPoint(x: resolvedOffset, y: clipView.bounds.minY))
            scrollView.reflectScrolledClipView(clipView)
            virtualScrollOffset = resolvedOffset
            pendingZoomGeneration = nil
            pendingTargetX = nil
            pendingDocumentWidth = nil
        }

        private func enclosingScrollViews(from view: NSView) -> [NSScrollView] {
            var scrollViews: [NSScrollView] = []
            var candidate = view.superview
            while let current = candidate {
                if let scrollView = current as? NSScrollView {
                    scrollViews.append(scrollView)
                }
                candidate = current.superview
            }
            return scrollViews
        }

        private func isCommandZoomEvent(_ event: NSEvent) -> Bool {
            let modifiers = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            if modifiers.contains(.command) {
                commandScrollSequenceActive = true
                return true
            }

            // Trackpads and Magic Mouse gestures can emit momentum events
            // after the modifier flag disappears. Keep consuming those events
            // so the vertical track scroller never receives the tail of a
            // Command-zoom gesture.
            let isGestureContinuation = event.phase != [] || event.momentumPhase != []
            guard commandScrollSequenceActive, isGestureContinuation else {
                commandScrollSequenceActive = false
                return false
            }
            if event.phase.contains(.ended)
                || event.phase.contains(.cancelled)
                || event.momentumPhase.contains(.ended)
            {
                commandScrollSequenceActive = false
            }
            return true
        }
    }
}

private struct TimelineContent: View {
    static let coordinateSpaceName = "yapper.timeline.content"

    @ObservedObject var session: EditorSession
    let contentWidth: Double
    @State private var marqueeStart: CGPoint?
    @State private var marqueeCurrent: CGPoint?
    @State private var marqueeBaseSelection: Set<TimelineSelectionItem> = []
    @State private var isMarqueeSelecting = false

    var body: some View {
        let textRowY = 45.0
        let overlayRowY = 105.0
        let clipRowY = 165.0
        let audioRowY = clipRowY + 94.0
        let playheadHeight = 341.0
        let itemFrames = marqueeItemFrames(
            textRowY: textRowY,
            overlayRowY: overlayRowY,
            clipRowY: clipRowY,
            audioRowY: audioRowY
        )

        ZStack(alignment: .topLeading) {
            VStack(spacing: 0) {
                Color.clear
                    .frame(height: 34)
                    .allowsHitTesting(false)
                Color.editorBackground
                    .contentShape(Rectangle())
                    .gesture(timelineTrackGesture(itemFrames: itemFrames))
            }
                .zIndex(0)
            TimelineRuler(duration: session.duration, width: contentWidth)
                .frame(height: 34)
                .background(Color.panelBackground)
                .contentShape(Rectangle())
                .gesture(timelineRulerSeekGesture)
                .zIndex(1)

            TimelineVideoTrack(session: session, contentWidth: contentWidth)
            .fixedSize(horizontal: true, vertical: true)
            .frame(height: 88, alignment: .top)
            .offset(y: clipRowY)
            .zIndex(2)

            if let textLayers = session.project.textLayers, !textLayers.isEmpty {
                ForEach(textLayers) { layer in
                    TimelineTextLayerCell(
                        session: session,
                        layer: layer,
                        contentWidth: contentWidth,
                        rowY: textRowY,
                        selected: session.isTimelineSelected(.text(layer.id))
                    )
                        .accessibilityLabel("Text layer: \(layer.text)")
                        .zIndex(3)
                }
            }

            if let overlays = session.project.overlays, !overlays.isEmpty {
                ForEach(overlays) { overlay in
                    if let media = session.project.media.first(where: { $0.id == overlay.mediaID }) {
                        TimelineOverlayItem(
                            session: session,
                            overlay: overlay,
                            media: media,
                            contentWidth: contentWidth,
                            rowY: overlayRowY,
                            selected: session.isTimelineSelected(.overlay(overlay.id))
                        )
                        .zIndex(3)
                    }
                }
            }

            if let audioLayers = session.project.audioLayers, !audioLayers.isEmpty {
                ForEach(audioLayers) { layer in
                    TimelineAudioItem(
                        session: session,
                        layer: layer,
                        contentWidth: contentWidth,
                        rowY: audioRowY,
                        selected: session.isTimelineSelected(.audio(layer.id))
                    )
                    .zIndex(3)
                }
            }

            if session.duration > 0 {
                let playheadX = TimelineMetrics.x(
                    for: session.currentTime,
                    duration: session.duration,
                    width: contentWidth
                )
                Rectangle()
                    .fill(Color.red)
                    .frame(width: 1.25, height: playheadHeight + 30)
                    .overlay(alignment: .top) {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 8, height: 8)
                            .offset(y: 26)
                    }
                    .offset(x: playheadX - 0.75)
                    .allowsHitTesting(false)
                    .zIndex(4)
            }

            if let snap = session.activeTimelineSnap, session.duration > 0 {
                let snapX = TimelineMetrics.x(
                    for: snap.time,
                    duration: session.duration,
                    width: contentWidth
                )
                Rectangle()
                    .fill(Color.yapperOrange.opacity(0.92))
                    .frame(width: 1, height: playheadHeight + 30)
                    .overlay(alignment: .topLeading) {
                        HStack(spacing: 4) {
                            Image(systemName: snap.kind == .audio ? "waveform" : "arrow.left.and.right")
                            Text("\(snap.kind.title)  \(formatTimelineTrimTime(snap.time))")
                        }
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.white)
                        .padding(.horizontal, 6)
                        .frame(height: 20)
                        .background(Color.yapperOrange.opacity(0.96))
                        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                        .fixedSize()
                        .offset(x: 4, y: -1)
                    }
                    .offset(x: snapX - 0.5)
                    .allowsHitTesting(false)
                    .zIndex(5)
            }

            if let marqueeStart, let marqueeCurrent, isMarqueeSelecting {
                let rect = TimelineMarqueeGeometry.rect(from: marqueeStart, to: marqueeCurrent)
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(Color.yapperOrange.opacity(0.12))
                    .overlay {
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .stroke(Color.yapperOrange.opacity(0.92), lineWidth: 1)
                    }
                    .frame(width: rect.width, height: rect.height)
                    .offset(x: rect.minX, y: rect.minY)
                    .allowsHitTesting(false)
                    .zIndex(6)
            }

        }
        .coordinateSpace(name: Self.coordinateSpaceName)
    }

    private var timelineRulerSeekGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.coordinateSpaceName))
            .onChanged { value in
                session.scrub(
                    to: TimelineMetrics.time(
                        for: value.location.x,
                        duration: session.duration,
                        width: contentWidth
                    )
                )
            }
            .onEnded { value in
                session.finishScrubbing(
                    at: TimelineMetrics.time(
                        for: value.location.x,
                        duration: session.duration,
                        width: contentWidth
                    )
                )
            }
    }

    private func timelineTrackGesture(itemFrames: [TimelineItemFrame]) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.coordinateSpaceName))
            .onChanged { value in
                if marqueeStart == nil {
                    marqueeStart = value.startLocation
                    marqueeCurrent = value.location
                    marqueeBaseSelection = session.timelineSelection
                }
                let distance = hypot(
                    value.location.x - value.startLocation.x,
                    value.location.y - value.startLocation.y
                )
                if distance >= 4 {
                    isMarqueeSelecting = true
                    marqueeCurrent = value.location
                    let flags = NSEvent.modifierFlags
                    session.setTimelineSelection(
                        TimelineMarqueeGeometry.selection(
                            intersecting: TimelineMarqueeGeometry.rect(
                                from: value.startLocation,
                                to: value.location
                            ),
                            itemFrames: itemFrames,
                            base: marqueeBaseSelection,
                            additive: flags.contains(.shift),
                            toggling: flags.contains(.command)
                        )
                    )
                }
            }
            .onEnded { value in
                if !isMarqueeSelecting {
                    session.setTimelineSelection([])
                    session.finishScrubbing(
                        at: TimelineMetrics.time(
                            for: value.location.x,
                            duration: session.duration,
                            width: contentWidth
                        )
                    )
                }
                marqueeStart = nil
                marqueeCurrent = nil
                marqueeBaseSelection = []
                isMarqueeSelecting = false
            }
    }

    private func marqueeItemFrames(
        textRowY: Double,
        overlayRowY: Double,
        clipRowY: Double,
        audioRowY: Double
    ) -> [TimelineItemFrame] {
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
                    frame: CGRect(x: x(overlay.timelineStart), y: overlayRowY, width: max(1, x(overlay.duration)), height: 42)
                )
            )
        }
        for layer in session.project.audioLayers ?? [] {
            frames.append(
                TimelineItemFrame(
                    item: .audio(layer.id),
                    frame: CGRect(x: x(layer.timelineStart), y: audioRowY, width: max(1, x(layer.duration)), height: 46)
                )
            )
        }
        return frames
    }
}

private struct TimelineVideoTrack: View {
    @ObservedObject var session: EditorSession
    let contentWidth: Double

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(session.project.clips) { clip in
                if let media = session.project.media(for: clip) {
                    TimelineVideoClipItem(
                        session: session,
                        clip: clip,
                        media: media,
                        thumbnails: session.thumbnailsByMedia[media.id] ?? [],
                        peaks: session.waveformByMedia[media.id] ?? [],
                        waveformProgress: session.waveformProgressByMedia[media.id] ?? 0,
                        contentWidth: contentWidth,
                        selected: session.isTimelineSelected(.clip(clip.id))
                    )
                }
            }
        }
    }
}

private struct TimelineVideoClipItem: View {
    @ObservedObject var session: EditorSession
    let clip: TimelineClip
    let media: ProjectMedia
    let thumbnails: [CGImage]
    let peaks: [Float]
    let waveformProgress: Double
    let contentWidth: Double
    let selected: Bool
    @State private var trimOrigin: TimelineClip?
    @State private var trimDraft: TimelineClip?
    @State private var activeTrimEdge: HorizontalEdge?
    @State private var snapAnchors: [TimelineSnapAnchor] = []
    @State private var selectionMoveBounds: (start: Double, end: Double)?
    @State private var isPromotingToOverlay = false

    var body: some View {
        let displayed = trimDraft ?? clip
        let originalWidth = max(
            1,
            contentWidth * clip.duration / max(0.001, session.duration)
        )
        let displayedWidth = max(
            1,
            contentWidth * displayed.duration / max(0.001, session.duration)
        )
        let leadingPreviewOffset = activeTrimEdge == .leading
            ? TimelineTrimGeometry.x(
                for: displayed.sourceStart - clip.sourceStart,
                contentWidth: contentWidth,
                projectDuration: session.duration
            )
            : 0
        let layoutWidth = activeTrimEdge == .leading ? originalWidth : displayedWidth

        ZStack(alignment: .leading) {
            TimelineClipCell(
                clip: displayed,
                media: media,
                thumbnails: thumbnails,
                peaks: peaks,
                waveformProgress: waveformProgress,
                selected: selected
            )
            .frame(width: displayedWidth, height: 88)
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
        .offset(
            x: selected
                ? TimelineTrimGeometry.x(
                    for: session.timelineSelectionDragDelta,
                    contentWidth: contentWidth,
                    projectDuration: session.duration
                )
                : 0,
            y: isPromotingToOverlay ? -60 : 0
        )
        .opacity(isPromotingToOverlay ? 0.82 : 1)
        .zIndex(activeTrimEdge == nil ? 0 : 10)
        .transaction { transaction in
            transaction.disablesAnimations = true
        }
        .contextMenu {
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
                isPromotingToOverlay = value.translation.height < -44
                if selectionMoveBounds == nil {
                    session.ensureTimelineItemSelected(.clip(clip.id))
                    selectionMoveBounds = session.timelineSelectionBounds()
                    snapAnchors = session.timelineSnapAnchors()
                }
                if isPromotingToOverlay {
                    session.previewTimelineSelectionMove(delta: 0)
                    session.setActiveTimelineSnap(nil)
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
                session.previewTimelineSelectionMove(delta: move.delta)
                session.setActiveTimelineSnap(move.match)
            }
            .onEnded { _ in
                let promote = isPromotingToOverlay
                isPromotingToOverlay = false
                selectionMoveBounds = nil
                snapAnchors = []
                session.setActiveTimelineSnap(nil)
                if promote {
                    Task { await session.promoteClipToOverlay(clip.id) }
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
                            snapAnchors = session.timelineSnapAnchors()
                            session.ensureTimelineItemSelected(.clip(clip.id))
                        }
                        guard let trimOrigin else { return }
                        let rawTranslation = value.location.x - value.startLocation.x
                        let rawDraft = TimelineClipGeometry.trimmed(
                            clip: trimOrigin,
                            edge: edge,
                            translationX: rawTranslation,
                            contentWidth: contentWidth,
                            projectDuration: session.duration,
                            mediaDuration: media.duration
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
                            projectDuration: session.duration,
                            enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                        )
                        trimDraft = TimelineClipGeometry.trimmed(
                            clip: trimOrigin,
                            edge: edge,
                            translationX: adjusted.translationX,
                            contentWidth: contentWidth,
                            projectDuration: session.duration,
                            mediaDuration: media.duration
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
                        NSCursor.arrow.set()
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
        mediaDuration: Double
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
            updated.sourceEnd = min(
                max(clip.sourceStart + minimumDuration, clip.sourceEnd + delta),
                mediaDuration
            )
        }
        return updated
    }
}

private struct TimelineTrimHandle: View {
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
        .frame(width: 18, height: height)
        .contentShape(Rectangle())
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
        .onHover { hovering in
            isHovering = hovering
            (hovering ? NSCursor.resizeLeftRight : NSCursor.arrow).set()
        }
        .animation(.easeOut(duration: 0.08), value: isHovering)
    }
}

private func formatTimelineTrimTime(_ seconds: Double) -> String {
    guard seconds.isFinite else { return "0:00.000" }
    let safe = max(0, seconds)
    let minutes = Int(safe) / 60
    let remainder = safe - Double(minutes * 60)
    return String(format: "%d:%06.3f", minutes, remainder)
}

private struct TimelineOverlayItem: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    let media: ProjectMedia
    let contentWidth: Double
    let rowY: Double
    let selected: Bool
    @State private var trimOrigin: ProjectOverlay?
    @State private var trimDraft: ProjectOverlay?
    @State private var moveOrigin: ProjectOverlay?
    @State private var moveDraft: ProjectOverlay?
    @State private var activeTrimEdge: HorizontalEdge?
    @State private var snapAnchors: [TimelineSnapAnchor] = []
    @State private var selectionMoveBounds: (start: Double, end: Double)?

    var body: some View {
        let displayed = trimDraft ?? moveDraft ?? overlay
        let startX = contentWidth * displayed.timelineStart / max(0.001, session.duration)
        let width = max(1, contentWidth * displayed.duration / max(0.001, session.duration))
        Button {
            selectTimelineItemFromPointer(.overlay(overlay.id), session: session)
        } label: {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(Color.yapperOrange.opacity(0.24))
                .overlay(alignment: .leading) {
                    HStack(spacing: 5) {
                        Image(systemName: "photo.on.rectangle")
                        Text(media.name).lineLimit(1)
                    }
                    .font(.studioCaptionStrong)
                    .padding(.horizontal, selected ? 11 : 7)
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .stroke(selected ? Color.yapperOrange : Color.yapperOrange.opacity(0.55), lineWidth: selected ? 1.1 : 0.7)
                }
        }
        .buttonStyle(.plain)
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
                        session.ensureTimelineItemSelected(.overlay(overlay.id))
                        snapAnchors = session.timelineSnapAnchors()
                        if session.timelineSelection.count > 1 {
                            selectionMoveBounds = session.timelineSelectionBounds()
                        } else {
                            moveOrigin = overlay
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
                    let rawDraft = TimelineOverlayGeometry.moved(
                        overlay: moveOrigin,
                        translationX: rawTranslation,
                        contentWidth: contentWidth,
                        projectDuration: session.duration
                    )
                    let adjusted = TimelineSnapDragGeometry.moveTranslation(
                        originalStart: moveOrigin.timelineStart,
                        proposedStart: rawDraft.timelineStart,
                        duration: rawDraft.duration,
                        rawTranslationX: rawTranslation,
                        anchors: snapAnchors,
                        contentWidth: contentWidth,
                        projectDuration: session.duration,
                        enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                    )
                    moveDraft = TimelineOverlayGeometry.moved(
                        overlay: moveOrigin,
                        translationX: adjusted.translationX,
                        contentWidth: contentWidth,
                        projectDuration: session.duration
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
                    if let moveDraft { session.commitOverlayTrim(moveDraft) }
                    moveDraft = nil
                    moveOrigin = nil
                    snapAnchors = []
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
                    for: session.timelineSelectionDragDelta,
                    contentWidth: contentWidth,
                    projectDuration: session.duration
                )
                : 0),
            y: rowY
        )
    }

    private func trimHandle(_ edge: HorizontalEdge) -> some View {
        let displayed = trimDraft ?? overlay
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
                            trimOrigin = overlay
                            activeTrimEdge = edge
                            snapAnchors = session.timelineSnapAnchors()
                            session.ensureTimelineItemSelected(.overlay(overlay.id))
                        }
                        guard let trimOrigin else { return }
                        let rawTranslation = value.location.x - value.startLocation.x
                        let rawDraft = TimelineOverlayGeometry.trimmed(
                            overlay: trimOrigin,
                            edge: edge,
                            translationX: rawTranslation,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
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
                            projectDuration: session.duration,
                            enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                        )
                        trimDraft = TimelineOverlayGeometry.trimmed(
                            overlay: trimOrigin,
                            edge: edge,
                            translationX: adjusted.translationX,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
                        )
                        session.setActiveTimelineSnap(adjusted.match)
                    }
                    .onEnded { _ in
                        if let trimDraft { session.commitOverlayTrim(trimDraft) }
                        trimDraft = nil
                        trimOrigin = nil
                        activeTrimEdge = nil
                        snapAnchors = []
                        session.setActiveTimelineSnap(nil)
                        NSCursor.arrow.set()
                    }
            )
            .help(edge == .leading ? "Trim overlay start" : "Extend or trim overlay end")
    }
}

private struct TimelineAudioItem: View {
    @ObservedObject var session: EditorSession
    let layer: ProjectAudioLayer
    let contentWidth: Double
    let rowY: Double
    let selected: Bool
    @State private var trimOrigin: ProjectAudioLayer?
    @State private var trimDraft: ProjectAudioLayer?
    @State private var moveOrigin: ProjectAudioLayer?
    @State private var moveDraft: ProjectAudioLayer?
    @State private var activeTrimEdge: HorizontalEdge?
    @State private var snapAnchors: [TimelineSnapAnchor] = []
    @State private var selectionMoveBounds: (start: Double, end: Double)?

    var body: some View {
        let displayed = trimDraft ?? moveDraft ?? layer
        let startX = contentWidth * displayed.timelineStart / max(0.001, session.duration)
        let width = max(1, contentWidth * displayed.duration / max(0.001, session.duration))
        Button {
            selectTimelineItemFromPointer(.audio(layer.id), session: session)
        } label: {
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .fill(Color(red: 0.07, green: 0.25, blue: 0.27).opacity(0.96))
                MiniAudioWave(seed: layer.name.hashValue)
                    .foregroundStyle(Color.cyan.opacity(0.58))
                    .padding(.horizontal, 5)
                HStack(spacing: 5) {
                    Image(systemName: "waveform")
                    Text(layer.name).lineLimit(1)
                }
                .font(.studioCaptionStrong)
                .padding(.horizontal, selected ? 11 : 7)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .stroke(selected ? Color.cyan.opacity(0.9) : Color.secondary.opacity(0.34), lineWidth: selected ? 1.1 : 0.7)
            }
        }
        .buttonStyle(.plain)
        .frame(width: width, height: 46)
        .clipped()
        .gesture(
            DragGesture(
                minimumDistance: 2,
                coordinateSpace: .named(TimelineContent.coordinateSpaceName)
            )
                .onChanged { value in
                    guard activeTrimEdge == nil else { return }
                    if moveOrigin == nil, selectionMoveBounds == nil {
                        session.ensureTimelineItemSelected(.audio(layer.id))
                        snapAnchors = session.timelineSnapAnchors()
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
                    let rawDraft = TimelineAudioGeometry.moved(
                        layer: moveOrigin,
                        translationX: rawTranslation,
                        contentWidth: contentWidth,
                        projectDuration: session.duration
                    )
                    let adjusted = TimelineSnapDragGeometry.moveTranslation(
                        originalStart: moveOrigin.timelineStart,
                        proposedStart: rawDraft.timelineStart,
                        duration: rawDraft.duration,
                        rawTranslationX: rawTranslation,
                        anchors: snapAnchors,
                        contentWidth: contentWidth,
                        projectDuration: session.duration,
                        enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                    )
                    moveDraft = TimelineAudioGeometry.moved(
                        layer: moveOrigin,
                        translationX: adjusted.translationX,
                        contentWidth: contentWidth,
                        projectDuration: session.duration
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
                    let committedMove = moveDraft
                    moveDraft = nil
                    moveOrigin = nil
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
                    for: session.timelineSelectionDragDelta,
                    contentWidth: contentWidth,
                    projectDuration: session.duration
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
                            snapAnchors = session.timelineSnapAnchors()
                            session.ensureTimelineItemSelected(.audio(layer.id))
                        }
                        guard let trimOrigin else { return }
                        let rawTranslation = value.location.x - value.startLocation.x
                        let rawDraft = TimelineAudioGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: rawTranslation,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
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
                            projectDuration: session.duration,
                            enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                        )
                        trimDraft = TimelineAudioGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: adjusted.translationX,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
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
                        NSCursor.arrow.set()
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

    static func trimmed(
        overlay: ProjectOverlay,
        edge: HorizontalEdge,
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
        let minimumDuration = min(0.2, max(0.02, projectDuration))
        switch edge {
        case .leading:
            let end = overlay.timelineStart + overlay.duration
            updated.timelineStart = min(end - minimumDuration, max(0, overlay.timelineStart + delta))
            updated.duration = end - updated.timelineStart
        case .trailing:
            updated.duration = min(
                max(minimumDuration, overlay.duration + delta),
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
    @ObservedObject var session: EditorSession
    let layer: ProjectTextLayer
    let contentWidth: Double
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
        let startX = contentWidth * displayed.timelineStart / max(0.001, session.duration)
        let width = max(1, contentWidth * displayed.duration / max(0.001, session.duration))
        RoundedRectangle(cornerRadius: 5, style: .continuous)
            .fill(Color(red: 0.42, green: 0.20, blue: 0.12).opacity(0.88))
            .overlay(alignment: .leading) {
                HStack(spacing: 5) {
                    Image(systemName: "textformat")
                    Text(displayed.text.isEmpty ? "Text" : displayed.text).lineLimit(1)
                }
                .font(.studioCaptionStrong)
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
                            snapAnchors = session.timelineSnapAnchors()
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
                            projectDuration: session.duration
                        )
                        let adjusted = TimelineSnapDragGeometry.moveTranslation(
                            originalStart: moveOrigin.timelineStart,
                            proposedStart: rawDraft.timelineStart,
                            duration: rawDraft.duration,
                            rawTranslationX: rawTranslation,
                            anchors: snapAnchors,
                            contentWidth: contentWidth,
                            projectDuration: session.duration,
                            enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                        )
                        moveDraft = TimelineTextGeometry.moved(
                            layer: moveOrigin,
                            translationX: adjusted.translationX,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
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
                        for: session.timelineSelectionDragDelta,
                        contentWidth: contentWidth,
                        projectDuration: session.duration
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
                            snapAnchors = session.timelineSnapAnchors()
                            session.ensureTimelineItemSelected(.text(layer.id))
                        }
                        guard let trimOrigin else { return }
                        let rawTranslation = value.location.x - value.startLocation.x
                        let rawDraft = TimelineTextGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: rawTranslation,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
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
                            projectDuration: session.duration,
                            enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                        )
                        trimDraft = TimelineTextGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: adjusted.translationX,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
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
                        NSCursor.arrow.set()
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

private struct TimelineRuler: View {
    let duration: Double
    let width: Double

    var body: some View {
        Canvas { context, size in
            guard duration > 0 else { return }
            let approximateStep = max(1, duration / max(2, floor(size.width / 100)))
            let majorStep = niceStep(approximateStep)
            let minorStep = majorStep / 5
            var time = 0.0
            var tick = 0
            while time <= duration + 0.001 {
                let x = TimelineMetrics.x(for: time, duration: duration, width: size.width)
                let isMajor = tick.isMultiple(of: 5)
                var path = Path()
                path.move(to: CGPoint(x: x, y: isMajor ? 18 : 25))
                path.addLine(to: CGPoint(x: x, y: 30))
                context.stroke(
                    path,
                    with: .color(Color.primary.opacity(isMajor ? 0.32 : 0.14)),
                    lineWidth: 1
                )
                if isMajor {
                    context.draw(
                        Text(formatTime(time))
                            .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                            .foregroundStyle(Color.primary.opacity(0.84)),
                        // Keep the ascenders inside the Canvas at every display
                        // scale; the old baseline could clip the time labels.
                        at: CGPoint(x: x + 3, y: 13),
                        anchor: .leading
                    )
                }
                tick += 1
                time += minorStep
            }
        }
    }

    private func niceStep(_ raw: Double) -> Double {
        let power = pow(10, floor(log10(raw)))
        let normalized = raw / power
        let nice: Double = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
        return nice * power
    }
}

private struct TimelineClipCell: View {
    let clip: TimelineClip
    let media: ProjectMedia
    let thumbnails: [CGImage]
    let peaks: [Float]
    let waveformProgress: Double
    let selected: Bool

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color(red: 0.12, green: 0.15, blue: 0.16)
                if !thumbnails.isEmpty {
                    StableThumbnailStrip(
                        thumbnails: thumbnails,
                        width: proxy.size.width,
                        sourceStart: clip.sourceStart,
                        sourceEnd: clip.sourceEnd,
                        mediaDuration: media.duration
                    )
                    .opacity(0.72)
                }
                LinearGradient(
                    colors: [.clear, .black.opacity(0.58)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                WaveformShape(
                    peaks: peaks,
                    sampleRange: waveformWindow.range,
                    color: .cyan.opacity(0.95)
                )
                .padding(.horizontal, 2)
                .padding(.bottom, 2)
                .frame(height: 30)
                .frame(width: max(0, proxy.size.width * waveformWindow.fraction), alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(maxHeight: .infinity, alignment: .bottom)

                Text(media.name)
                    .font(.system(size: 10, weight: .semibold))
                    .lineLimit(1)
                    .padding(5)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .opacity(proxy.size.width > 65 ? 1 : 0)
            }
            .clipped()
            .overlay(
                RoundedRectangle(cornerRadius: 5)
                    .stroke(
                        selected ? Color.white.opacity(0.86) : Color.secondary.opacity(0.28),
                        lineWidth: selected ? 1.15 : 0.55
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 5))
        }
    }

    private var waveformWindow: TimelineWaveformWindow {
        TimelineWaveformGeometry.window(
            peakCount: peaks.count,
            progress: waveformProgress,
            sourceStart: clip.sourceStart,
            sourceEnd: clip.sourceEnd,
            mediaDuration: media.duration
        )
    }
}

private struct StableThumbnailStrip: View {
    let thumbnails: [CGImage]
    let width: CGFloat
    let sourceStart: Double
    let sourceEnd: Double
    let mediaDuration: Double

    private let tileWidth: CGFloat = 74

    var body: some View {
        HStack(spacing: 1) {
            ForEach(0 ..< tileCount, id: \.self) { tile in
                let index = thumbnailIndex(for: tile)
                Image(decorative: thumbnails[index], scale: 1)
                    .resizable()
                    .scaledToFill()
                    .frame(width: tileWidth, height: 88)
                    .clipped()
            }
        }
        .frame(width: width, height: 88, alignment: .leading)
        .clipped()
    }

    private var tileCount: Int {
        // Keep thumbnails a constant visual size while zooming. This avoids the
        // stretched/cropped strip that made clips appear to resize at each zoom.
        max(1, min(1_200, Int(ceil(width / (tileWidth + 1)))))
    }

    private func thumbnailIndex(for tile: Int) -> Int {
        guard thumbnails.count > 1, mediaDuration > 0 else { return 0 }
        let tileFraction = (Double(tile) + 0.5) / Double(tileCount)
        let sourceTime = sourceStart + max(0, sourceEnd - sourceStart) * tileFraction
        let mediaFraction = min(0.999, max(0, sourceTime / mediaDuration))
        return min(thumbnails.count - 1, Int(mediaFraction * Double(thumbnails.count)))
    }
}

private struct TrackHeader: View {
    let hasText: Bool
    let hasOverlays: Bool
    let hasAudio: Bool

    var body: some View {
        VStack(spacing: 0) {
            Color.clear.frame(height: 38)
            if hasText {
                HStack(spacing: 7) {
                    Image(systemName: "textformat")
                    Text("Text")
                }
                .font(.studioCaptionStrong)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 60)
                .background(Color.yapperOrange.opacity(0.035))
            }
            if hasOverlays {
                HStack(spacing: 7) {
                    Image(systemName: "photo.on.rectangle")
                    Text("Overlay")
                }
                .font(.studioCaptionStrong)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 60)
                .background(Color.yapperOrange.opacity(0.045))
            }
            HStack(spacing: 7) {
                Image(systemName: "eye")
                Image(systemName: "speaker.wave.2")
                Image(systemName: "lock.open")
            }
            .font(.studioCaptionStrong)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 88)
            .background(Color.studioFaintFill.opacity(0.55))
            if hasAudio {
                HStack(spacing: 7) {
                    Image(systemName: "waveform")
                    Text("Audio")
                }
                .font(.studioCaptionStrong)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 58)
                .background(Color.cyan.opacity(0.035))
            }
            Spacer()
        }
        .background(Color.panelBackground.opacity(0.72))
    }
}

private struct MiniAudioWave: Shape {
    let seed: Int

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let count = max(4, Int(rect.width / 5))
        let middle = rect.midY
        for index in 0 ..< count {
            let mixed = abs((index &* 73 &+ seed) % 97)
            let amplitude = max(2, CGFloat(mixed) / 96 * rect.height * 0.72)
            let x = rect.minX + CGFloat(index) / CGFloat(max(1, count - 1)) * rect.width
            path.move(to: CGPoint(x: x, y: middle - amplitude / 2))
            path.addLine(to: CGPoint(x: x, y: middle + amplitude / 2))
        }
        return path
    }
}

private struct WaveformShape: View {
    let peaks: [Float]
    let sampleRange: Range<Int>
    let color: Color

    var body: some View {
        Canvas { context, size in
            let lowerBound = max(0, min(peaks.count, sampleRange.lowerBound))
            let upperBound = max(lowerBound, min(peaks.count, sampleRange.upperBound))
            let sampleCount = upperBound - lowerBound
            guard sampleCount > 0, size.width > 0 else { return }
            let barWidth: CGFloat = 1.5
            let barGap: CGFloat = 1
            let step = barWidth + barGap
            let columns = max(1, Int(ceil(size.width / step)))
            let middle = size.height / 2
            for column in 0 ..< columns {
                let samples = TimelineWaveformGeometry.sampleRange(
                    column: column,
                    columnCount: columns,
                    samples: lowerBound ..< upperBound
                )
                guard !samples.isEmpty else { continue }
                let peak = peaks[samples].max() ?? 0
                let emphasized = pow(CGFloat(max(0, peak)), 0.72)
                let height = max(1.5, emphasized * (size.height - 2))
                let x = CGFloat(column) * step
                guard x < size.width else { break }
                let rect = CGRect(
                    x: x,
                    y: middle - height / 2,
                    width: min(barWidth, size.width - x),
                    height: height
                )
                context.fill(
                    Path(roundedRect: rect, cornerRadius: 0.75),
                    with: .color(color)
                )
            }
        }
    }
}
