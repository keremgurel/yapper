@preconcurrency import AppKit
import CoreGraphics
import SwiftUI

struct TimelinePanel: View {
    @ObservedObject var session: EditorSession
    @State private var pointsPerSecond = 36.0

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text("Timeline")
                    .font(.studioBodyStrong)
                Text("\(session.project.clips.count) clips")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
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
                let contentWidth = max(
                    proxy.size.width - 86,
                    session.duration * pointsPerSecond
                )
                HStack(spacing: 0) {
                    TrackHeader(
                        hasText: session.project.textLayers?.isEmpty == false,
                        hasOverlays: session.project.overlays?.isEmpty == false,
                        hasAudio: session.project.audioLayers?.isEmpty == false
                    )
                        .frame(width: 70)
                    Rectangle().fill(Color.studioLine).frame(width: 1)
                    ScrollView(.horizontal, showsIndicators: true) {
                        TimelineContent(
                            session: session,
                            contentWidth: contentWidth
                        )
                        .frame(width: contentWidth, height: max(230, proxy.size.height - 12))
                        .padding(.horizontal, 10)
                        .background {
                            TimelineZoomInputView { factor in
                                applyZoom(factor)
                            }
                        }
                    }
                }
            }
        }
        .background(Color.editorBackground)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }

    private func applyZoom(_ factor: Double) -> Double {
        let previous = pointsPerSecond
        let updated = TimelineZoomGeometry.scaled(previous, by: factor)
        guard abs(updated - previous) > 0.0001 else { return 1 }
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            pointsPerSecond = updated
        }
        return updated / previous
    }
}

enum TimelineZoomGeometry {
    static let scaleRange = 18.0 ... 240.0

    static func scaled(_ current: Double, by factor: Double) -> Double {
        min(scaleRange.upperBound, max(scaleRange.lowerBound, current * factor))
    }

    static func anchoredOffset(
        oldOffset: CGFloat,
        pointerX: CGFloat,
        oldContentWidth: CGFloat,
        newContentWidth: CGFloat,
        viewportWidth: CGFloat
    ) -> CGFloat {
        guard oldContentWidth > 0, newContentWidth > 0 else { return 0 }
        let documentX = oldOffset + pointerX
        let fraction = min(1, max(0, documentX / oldContentWidth))
        let proposed = fraction * newContentWidth - pointerX
        return min(max(0, newContentWidth - viewportWidth), max(0, proposed))
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
    let onZoom: (Double) -> Double

    func makeCoordinator() -> Coordinator {
        Coordinator(onZoom: onZoom)
    }

    func makeNSView(context: Context) -> TimelineZoomMonitorView {
        let view = TimelineZoomMonitorView()
        context.coordinator.view = view
        context.coordinator.install()
        return view
    }

    func updateNSView(_ nsView: TimelineZoomMonitorView, context: Context) {
        context.coordinator.view = nsView
        context.coordinator.onZoom = onZoom
    }

    static func dismantleNSView(_ nsView: TimelineZoomMonitorView, coordinator: Coordinator) {
        coordinator.uninstall()
    }

    @MainActor
    final class Coordinator {
        weak var view: TimelineZoomMonitorView?
        var onZoom: (Double) -> Double
        private var monitor: Any?

        init(onZoom: @escaping (Double) -> Double) {
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
                event.window === window,
                view.bounds.contains(view.convert(event.locationInWindow, from: nil))
            else { return event }

            let requestedFactor: Double
            switch event.type {
            case .magnify:
                requestedFactor = min(1.35, max(0.72, 1 + Double(event.magnification)))
            case .scrollWheel where event.modifierFlags.contains(.command):
                let sensitivity = event.hasPreciseScrollingDeltas ? 0.012 : 0.075
                requestedFactor = min(
                    1.35,
                    max(0.72, exp(Double(event.scrollingDeltaY) * sensitivity))
                )
            default:
                return event
            }

            let scrollView = enclosingScrollView(from: view)
            let clipView = scrollView?.contentView
            let pointerX = clipView?.convert(event.locationInWindow, from: nil).x ?? 0
            let oldOffset = clipView?.bounds.minX ?? 0
            let oldContentWidth = scrollView?.documentView?.bounds.width ?? view.bounds.width
            let appliedFactor = onZoom(requestedFactor)
            guard abs(appliedFactor - 1) > 0.0001 else { return nil }

            DispatchQueue.main.async { [weak scrollView] in
                guard let scrollView else { return }
                let clipView = scrollView.contentView
                let newContentWidth = scrollView.documentView?.bounds.width ?? oldContentWidth * appliedFactor
                let x = TimelineZoomGeometry.anchoredOffset(
                    oldOffset: oldOffset,
                    pointerX: pointerX,
                    oldContentWidth: oldContentWidth,
                    newContentWidth: newContentWidth,
                    viewportWidth: clipView.bounds.width
                )
                clipView.scroll(to: CGPoint(x: x, y: clipView.bounds.minY))
                scrollView.reflectScrolledClipView(clipView)
            }
            return nil
        }

        private func enclosingScrollView(from view: NSView) -> NSScrollView? {
            var candidate = view.superview
            while let current = candidate {
                if let scrollView = current as? NSScrollView { return scrollView }
                candidate = current.superview
            }
            return nil
        }
    }
}

private struct TimelineContent: View {
    static let coordinateSpaceName = "yapper.timeline.content"

    @ObservedObject var session: EditorSession
    let contentWidth: Double

    var body: some View {
        let hasText = session.project.textLayers?.isEmpty == false
        let hasOverlays = session.project.overlays?.isEmpty == false
        let hasAudio = session.project.audioLayers?.isEmpty == false
        let textRowY = 45.0
        let overlayRowY = 45.0 + (hasText ? 60.0 : 0)
        let clipRowY = 45.0 + (hasText ? 60.0 : 0) + (hasOverlays ? 60.0 : 0)
        let audioRowY = clipRowY + 94.0
        let playheadHeight = 103.0 + (hasText ? 60.0 : 0) + (hasOverlays ? 60.0 : 0) + (hasAudio ? 58.0 : 0)

        ZStack(alignment: .topLeading) {
            Color.editorBackground
                .contentShape(Rectangle())
                .gesture(emptySpaceSeekGesture)
                .zIndex(0)
            TimelineRuler(duration: session.duration, width: contentWidth)
                .frame(height: 34)
                .allowsHitTesting(false)
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
                        selected: session.selectedTextLayerID == layer.id
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
                            selected: session.selectedOverlayID == overlay.id
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
                        selected: session.selectedAudioLayerID == layer.id
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
                    .frame(width: 1.25, height: playheadHeight)
                    .overlay(alignment: .top) {
                        Circle().fill(Color.red).frame(width: 8, height: 8)
                    }
                    .offset(x: playheadX - 0.75, y: 30)
                    .allowsHitTesting(false)
                    .zIndex(4)
            }

        }
        .coordinateSpace(name: Self.coordinateSpaceName)
    }

    private var emptySpaceSeekGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { value in
                let time = TimelineMetrics.time(
                    for: value.location.x,
                    duration: session.duration,
                    width: contentWidth
                )
                session.scrub(to: time)
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
                        selected: session.selectedClipID == clip.id
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
            .onTapGesture { session.select(clip.id) }
            .overlay(alignment: .leading) {
                if selected { trimHandle(edge: .leading) }
            }
            .overlay(alignment: .trailing) {
                if selected { trimHandle(edge: .trailing) }
            }
            .offset(x: leadingPreviewOffset)
        }
        .frame(width: layoutWidth, height: 88, alignment: .leading)
        .zIndex(activeTrimEdge == nil ? 0 : 10)
        .transaction { transaction in
            transaction.disablesAnimations = true
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
                            session.select(clip.id)
                        }
                        guard let trimOrigin else { return }
                        trimDraft = TimelineClipGeometry.trimmed(
                            clip: trimOrigin,
                            edge: edge,
                            translationX: value.location.x - value.startLocation.x,
                            contentWidth: contentWidth,
                            projectDuration: session.duration,
                            mediaDuration: media.duration
                        )
                    }
                    .onEnded { _ in
                        let committedTrim = trimDraft
                        trimDraft = nil
                        trimOrigin = nil
                        activeTrimEdge = nil
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

enum TimelineTrimGeometry {
    static func timeDelta(
        for translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double
    ) -> Double {
        guard contentWidth > 0, projectDuration > 0 else { return 0 }
        return Double(translationX) * projectDuration / contentWidth
    }

    static func x(
        for time: Double,
        contentWidth: Double,
        projectDuration: Double
    ) -> CGFloat {
        guard contentWidth > 0, projectDuration > 0 else { return 0 }
        return CGFloat(time / projectDuration * contentWidth)
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
    @State private var activeTrimEdge: HorizontalEdge?

    var body: some View {
        let displayed = trimDraft ?? overlay
        let startX = contentWidth * displayed.timelineStart / max(0.001, session.duration)
        let width = max(1, contentWidth * displayed.duration / max(0.001, session.duration))
        Button {
            session.selectOverlay(overlay.id)
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
        .overlay(alignment: .leading) {
            if selected { trimHandle(.leading) }
        }
        .overlay(alignment: .trailing) {
            if selected { trimHandle(.trailing) }
        }
        .offset(x: startX, y: rowY)
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
                            session.selectOverlay(overlay.id)
                        }
                        guard let trimOrigin else { return }
                        trimDraft = TimelineOverlayGeometry.trimmed(
                            overlay: trimOrigin,
                            edge: edge,
                            translationX: value.location.x - value.startLocation.x,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
                        )
                    }
                    .onEnded { _ in
                        if let trimDraft { session.commitOverlayTrim(trimDraft) }
                        trimDraft = nil
                        trimOrigin = nil
                        activeTrimEdge = nil
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
    @State private var activeTrimEdge: HorizontalEdge?

    var body: some View {
        let displayed = trimDraft ?? layer
        let startX = contentWidth * displayed.timelineStart / max(0.001, session.duration)
        let width = max(1, contentWidth * displayed.duration / max(0.001, session.duration))
        Button {
            session.selectAudioLayer(layer.id)
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
        .overlay(alignment: .leading) {
            if selected { trimHandle(.leading) }
        }
        .overlay(alignment: .trailing) {
            if selected { trimHandle(.trailing) }
        }
        .offset(x: startX, y: rowY)
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
                            session.selectAudioLayer(layer.id)
                        }
                        guard let trimOrigin else { return }
                        trimDraft = TimelineAudioGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: value.location.x - value.startLocation.x,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
                        )
                    }
                    .onEnded { _ in
                        let committedTrim = trimDraft
                        trimDraft = nil
                        trimOrigin = nil
                        activeTrimEdge = nil
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
            .onTapGesture { session.selectTextLayer(displayed.id) }
            .frame(width: width, height: 42)
            .clipped()
            .gesture(
                DragGesture(
                    minimumDistance: 2,
                    coordinateSpace: .named(TimelineContent.coordinateSpaceName)
                )
                    .onChanged { value in
                        guard activeTrimEdge == nil else { return }
                        if moveOrigin == nil {
                            moveOrigin = layer
                            session.selectTextLayer(layer.id)
                        }
                        guard let moveOrigin else { return }
                        moveDraft = TimelineTextGeometry.moved(
                            layer: moveOrigin,
                            translationX: value.location.x - value.startLocation.x,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
                        )
                    }
                    .onEnded { _ in
                        if let moveDraft { session.updateTextLayer(moveDraft) }
                        moveDraft = nil
                        moveOrigin = nil
                    }
            )
            .overlay(alignment: .leading) {
                if selected { trimHandle(edge: .leading) }
            }
            .overlay(alignment: .trailing) {
                if selected { trimHandle(edge: .trailing) }
            }
            .offset(x: startX, y: rowY)
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
                            session.selectTextLayer(layer.id)
                        }
                        guard let trimOrigin else { return }
                        trimDraft = TimelineTextGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: value.location.x - value.startLocation.x,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
                        )
                    }
                    .onEnded { _ in
                        if let trimDraft { session.updateTextLayer(trimDraft) }
                        trimDraft = nil
                        trimOrigin = nil
                        activeTrimEdge = nil
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
                    with: .color(.white.opacity(isMajor ? 0.2 : 0.09)),
                    lineWidth: 1
                )
                if isMajor {
                    context.draw(
                        Text(formatTime(time))
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(.secondary),
                        at: CGPoint(x: x + 3, y: 9),
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
