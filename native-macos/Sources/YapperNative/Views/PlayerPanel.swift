import SwiftUI

struct PlayerPanel: View {
    @ObservedObject var session: EditorSession
    @ObservedObject private var previewPresentation: PreviewPresentationState
    let layoutMode: EditorLayoutMode
    let showsSeekBar: Bool
    /// How far the stage is pulled back from the panel. View state on purpose:
    /// it is how you are looking at the project, not part of it, and it has no
    /// business being saved or exported. See `PreviewZoom`.
    @State private var zoom: PreviewZoom = .fit
    /// Where a pinch started, so its factor is applied once rather than
    /// compounding on every step of the gesture.
    @State private var zoomAtPinchStart: PreviewZoom?

    init(
        session: EditorSession,
        layoutMode: EditorLayoutMode,
        showsSeekBar: Bool = false
    ) {
        self.session = session
        self.layoutMode = layoutMode
        self.showsSeekBar = showsSeekBar
        _previewPresentation = ObservedObject(
            wrappedValue: session.previewPresentation
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            GeometryReader { proxy in
                let stageSize = fittedStageSize(in: proxy.size)
                ZStack {
                    // The room around the stage, and the way out of everything
                    // on it. Under the stage, so only a click that misses the
                    // picture entirely lands here.
                    Color.previewWorkspaceBackground
                        .contentShape(Rectangle())
                        .onTapGesture { session.clearCanvasSelection() }
                    ZStack {
                        Color.black
                        if session.project.clips.isEmpty {
                            VStack(spacing: 10) {
                                Image(systemName: "play.rectangle")
                                    .font(.system(size: 34, weight: .light))
                                    .foregroundStyle(.secondary)
                                Text("Native preview")
                                    .font(.system(size: 14, weight: .bold))
                                Text("Import one or several videos. The editor opens directly here.")
                                    .font(.studioCaption)
                                    .foregroundStyle(.secondary)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, 24)
                            }
                        } else {
                            FramedPlayerView(
                                session: session,
                                drag: session.canvasDrag,
                                renderedFraming: session.renderedFraming,
                                stageSize: stageSize
                            )
                        }

                        // Clicking the picture itself picks the picture up, so
                        // the framing handles are where the thing they frame
                        // is. It sits under every item, so a click on a
                        // caption, a text layer or an overlay still reaches the
                        // item and only a click that misses them all lands here.
                        Color.clear
                            .contentShape(Rectangle())
                            .onTapGesture { session.selectVideoFrame() }

                        // Under everything that is drawn over the video, since
                        // it is the video.
                        VideoFrameCanvasLayer(session: session, drag: session.canvasDrag)

                        // Under the text and the captions, the way they stack
                        // in the export.
                        OverlayCanvasLayer(
                            session: session,
                            clock: session.playbackClock,
                            cursor: session.playbackCursor
                        )
                        TextLayerCanvasOverlay(session: session, cursor: session.playbackCursor)
                        // Captions are draggable on the canvas, so this layer
                        // has to take clicks. Only the card itself is hittable;
                        // the rest of the layer stays transparent to the player.
                        CaptionCanvasOverlay(session: session, cursor: session.playbackCursor)
                    }
                    .frame(width: stageSize.width, height: stageSize.height)
                    // What every drag on the canvas is measured against. It has
                    // to be something that stands still: see
                    // CanvasCoordinateSpace.
                    .coordinateSpace(name: CanvasCoordinateSpace.stage)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    // Outside the clip on purpose: the box follows the picture,
                    // and the picture is often zoomed past the frame. See
                    // VideoFrameHandleOverlay.
                    .overlay {
                        if session.isVideoFrameSelected {
                            VideoFrameHandleOverlay(
                                session: session,
                                drag: session.canvasDrag,
                                stageSize: stageSize
                            )
                        }
                    }
                    // Outside the clip for the same reason: an overlay can be
                    // full frame, larger than it or moved partly off it, and
                    // its grips have to stay where you can reach them. See
                    // CanvasSelectionChrome.
                    .overlay {
                        CanvasSelectionChrome(session: session, stageSize: stageSize)
                    }
                    // Over the picture and under the offline banner: it points
                    // at something in the picture, so it has to be on top of
                    // it, and it has nothing to say when there is no picture.
                    .overlay {
                        if session.showsFaceIndicator {
                            SpeakerFaceIndicator(
                                session: session,
                                clock: session.playbackClock,
                                stageSize: stageSize
                            )
                        }
                    }
                    // Over everything on the canvas: when the footage cannot be
                    // read, why that is beats anything drawn on top of it.
                    .overlay {
                        OfflineMediaBanner(
                            session: session,
                            availability: session.mediaAvailability
                        )
                    }
                    // Over the clip, so the bar is never cut in half by the
                    // edge of the stage it belongs to.
                    .overlay(alignment: .bottom) {
                        if session.isVideoFrameSelected {
                            VideoFrameControlBar(session: session, drag: session.canvasDrag)
                                .transition(.opacity.combined(with: .offset(y: 6)))
                        }
                    }
                    .animation(.easeOut(duration: 0.16), value: session.isVideoFrameSelected)
                    // The shadow is cast by a plain rectangle behind the stage,
                    // not by the stage itself. Shadowing the stage made Core
                    // Animation work out the alpha of the video, the captions
                    // and the text layers on every frame of a window resize.
                    .background {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color.black)
                            .shadow(color: .black.opacity(0.52), radius: 16, y: 6)
                    }
                    .overlay(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .stroke(Color.previewCanvasBorder, lineWidth: 1)
                    )
                    // Past the fit the stage is larger than the panel, so it is
                    // put on a scroller and the rest of it is a scroll away.
                    // Always a scroller rather than one that appears at 101%,
                    // so the player view underneath keeps its identity and does
                    // not tear down and rebuild on the way past.
                    .modifier(ScrollableStage(size: proxy.size, enabled: zoom.isPastFit))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                // Handles hanging outside the stage are the point, handles
                // hanging over the timeline are not. Zooming out is what brings
                // a far-flung corner back inside this.
                .clipped()
                .gesture(pinchToZoom)
                .padding(layoutMode == .standard ? 18 : 10)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            TransportBar(
                session: session,
                previewPresentation: previewPresentation,
                zoom: $zoom,
                showsSeekBar: showsSeekBar
            )
        }
        .background(Color.previewWorkspaceBackground)
        .onExitCommand { previewPresentation.exitFullScreen() }
    }

    /// A trackpad pinch, which is what anyone coming from another editor tries
    /// first. Measured from where the pinch began rather than from the last
    /// step, so the same spread always lands on the same zoom.
    private var pinchToZoom: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let start = zoomAtPinchStart ?? zoom
                if zoomAtPinchStart == nil { zoomAtPinchStart = start }
                zoom = start.scaled(by: value.magnification)
            }
            .onEnded { _ in zoomAtPinchStart = nil }
    }

    /// The stage: as large as the panel allows, then pulled back by however far
    /// the preview has been zoomed out.
    private func fittedStageSize(in container: CGSize) -> CGSize {
        let inset: CGFloat = layoutMode == .standard ? 36 : 20
        let available = CGSize(
            width: max(1, container.width - inset),
            height: max(1, container.height - inset)
        )
        let aspect = CGFloat(session.project.resolvedAspectRatio)
        let fitted = available.width / available.height > aspect
            ? CGSize(width: available.height * aspect, height: available.height)
            : CGSize(width: available.width, height: available.width / aspect)
        return CGSize(
            width: fitted.width * zoom.scale,
            height: fitted.height * zoom.scale
        )
    }
}

private struct TextLayerCanvasOverlay: View {
    @ObservedObject var session: EditorSession
    /// Watches which layers are on screen rather than the clock: see
    /// OverlayCanvasLayer for why.
    @ObservedObject var cursor: PlaybackCursor
    @State private var alignmentGuides = TextCanvasAlignmentGuides()

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                ForEach(visibleLayers) { layer in
                    TextLayerCanvasItem(
                        session: session,
                        layer: layer,
                        canvasSize: proxy.size,
                        selected: session.selectedTextLayerID == layer.id,
                        alignmentGuides: $alignmentGuides,
                        drag: session.canvasDrag
                    )
                }

                TextCanvasGuideOverlay(guides: alignmentGuides)
                    .allowsHitTesting(false)
                    .zIndex(20)
            }
        }
    }

    private var visibleLayers: [ProjectTextLayer] {
        let onScreen = cursor.canvasItems.textLayerIDs
        return (session.project.textLayers ?? []).filter { onScreen.contains($0.id) }
    }
}

private struct TextLayerCanvasItem: View {
    @ObservedObject var session: EditorSession
    let layer: ProjectTextLayer
    let canvasSize: CGSize
    let selected: Bool
    @Binding var alignmentGuides: TextCanvasAlignmentGuides
    /// Held on the session: see CanvasDragState. These views are rebuilt while
    /// a gesture runs, and a drag kept here went with them.
    @ObservedObject var drag: CanvasDragState

    /// What the gesture is doing right now wins over what is saved, so a drag
    /// stays smooth while the project catches up behind it.
    private var displayed: ProjectTextLayer { drag.textDraft(for: layer.id) ?? layer }

    var body: some View {
        TextLayerCanvasLabel(layer: displayed, canvasSize: canvasSize)
            .contentShape(Rectangle())
            .onTapGesture { session.selectTextLayer(layer.id) }
            .gesture(
                // Measured against the stage, never against the layer: the
                // layer is moving with the drag. See CanvasCoordinateSpace.
                DragGesture(minimumDistance: 1, coordinateSpace: .named(CanvasCoordinateSpace.stage))
                    .onChanged { value in
                        if drag.textOrigin?.id != layer.id {
                            drag.beginText(layer)
                            // See OverlayCanvasItem: re-selecting mid-drag
                            // rebuilds the view.
                            if !selected { session.selectTextLayer(layer.id) }
                        }
                        guard let origin = drag.textOrigin else { return }
                        let result = TextCanvasGeometry.moved(
                            layer: origin,
                            origin: CGPoint(x: origin.x, y: origin.y),
                            translation: value.translation,
                            canvasSize: canvasSize
                        )
                        alignmentGuides = result.guides
                        drag.updateText(result.layer)
                    }
                    .onEnded { _ in
                        if let finished = drag.holdText() {
                            TextLayerCanvasCommit.commit(finished, session: session, drag: drag)
                        }
                        alignmentGuides = TextCanvasAlignmentGuides()
                    }
            )
            // The outline, corners and rotate grip are drawn over the stage by
            // TextLayerSelectionChrome, so the clip at the frame's edge cannot
            // cut them off.
            .rotationEffect(.degrees(displayed.rotation))
            // Placed last: `position` hands back a view the size of the whole
            // canvas, so anything after it would claim the lot.
            .position(
                x: canvasSize.width * layer.x,
                y: canvasSize.height * layer.y
            )
            .offset(TextLayerCanvasCommit.dragOffset(for: layer, drag: drag, canvasSize: canvasSize))
    }
}

struct TextCanvasAlignmentGuides: Equatable {
    var verticalCenter = false
    var horizontalCenter = false
}

enum TextCanvasGeometry {
    static let snapThreshold: CGFloat = 8

    static func moved(
        layer: ProjectTextLayer,
        origin: CGPoint,
        translation: CGSize,
        canvasSize: CGSize
    ) -> (layer: ProjectTextLayer, guides: TextCanvasAlignmentGuides) {
        var updated = layer
        let width = max(1, canvasSize.width)
        let height = max(1, canvasSize.height)
        var x = TextStyle.clampPosition(origin.x + translation.width / width)
        var y = min(0.94, max(0.06, origin.y + translation.height / height))
        let verticalCenter = abs(x - 0.5) * width <= snapThreshold
        let horizontalCenter = abs(y - 0.5) * height <= snapThreshold
        if verticalCenter { x = 0.5 }
        if horizontalCenter { y = 0.5 }
        updated.x = x
        updated.y = y
        return (
            updated,
            TextCanvasAlignmentGuides(
                verticalCenter: verticalCenter,
                horizontalCenter: horizontalCenter
            )
        )
    }

    /// The card turned by dragging its rotate handle, snapped onto the quarter
    /// turns unless Option says otherwise.
    static func rotated(
        layer: ProjectTextLayer,
        centre: CGPoint,
        from start: CGPoint,
        to current: CGPoint,
        snapping: Bool = true
    ) -> ProjectTextLayer {
        let swept = VideoFramingGeometry.angle(at: current, about: centre)
            - VideoFramingGeometry.angle(at: start, about: centre)
        var rotation = VideoFraming.wrap(layer.rotation + swept)
        if snapping {
            let quarter = (rotation / 90).rounded() * 90
            if abs(rotation - quarter) <= VideoFramingGeometry.rotationSnapDegrees {
                rotation = quarter
            }
        }
        var turned = layer
        turned.rotation = rotation
        return turned
    }

    static func resized(
        layer: ProjectTextLayer,
        translation: CGSize,
        corner: CanvasResizeCorner,
        canvasSize: CGSize
    ) -> ProjectTextLayer {
        var updated = layer
        // Along the card's own axes, not the screen's: a corner of a turned
        // card points somewhere else, and pulling it outwards has to grow the
        // card whichever way outwards happens to be.
        let radians = -layer.rotationRadians
        let along = CGSize(
            width: Double(translation.width) * cos(radians)
                - Double(translation.height) * sin(radians),
            height: Double(translation.width) * sin(radians)
                + Double(translation.height) * cos(radians)
        )
        let projected = (
            Double(along.width) * corner.xSign
                + Double(along.height) * corner.ySign
        ) / 2
        let referenceWidth = max(72, Double(canvasSize.width) * layer.width)
        let scale = min(3.2, max(0.35, 1 + projected / referenceWidth))
        let newWidth = min(0.95, max(TextStyle.minimumWidth, layer.width * scale))
        let newFontScale = min(0.16, max(0.018, layer.fontScale * scale))

        // Keep the opposite corner visually anchored while the dragged corner moves.
        updated.x = TextStyle.clampPosition(layer.x + (newWidth - layer.width) * corner.xSign / 2)
        updated.y = min(
            0.94,
            max(0.06, layer.y + (newFontScale - layer.fontScale) * corner.ySign * 0.7)
        )
        updated.width = newWidth
        updated.fontScale = newFontScale
        return updated
    }
}

private struct TextCanvasGuideOverlay: View {
    let guides: TextCanvasAlignmentGuides

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                if guides.verticalCenter {
                    DashedGuideLine(vertical: true)
                        .frame(width: 1, height: proxy.size.height)
                        .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
                }
                if guides.horizontalCenter {
                    DashedGuideLine(vertical: false)
                        .frame(width: proxy.size.width, height: 1)
                        .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
                }
            }
        }
    }
}

private struct DashedGuideLine: View {
    let vertical: Bool

    var body: some View {
        Canvas { context, size in
            var path = Path()
            if vertical {
                path.move(to: CGPoint(x: size.width / 2, y: 0))
                path.addLine(to: CGPoint(x: size.width / 2, y: size.height))
            } else {
                path.move(to: CGPoint(x: 0, y: size.height / 2))
                path.addLine(to: CGPoint(x: size.width, y: size.height / 2))
            }
            context.stroke(
                path,
                with: .color(Color.cyan.opacity(0.92)),
                style: StrokeStyle(lineWidth: 1, dash: [5, 4])
            )
        }
        .shadow(color: .black.opacity(0.55), radius: 1)
    }
}

/// Shared with the shell, which keeps Chirpy clear of the bar.
enum TransportBarMetrics {
    static let height: CGFloat = 40
}

private struct TransportBar: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var previewPresentation: PreviewPresentationState
    @Binding var zoom: PreviewZoom
    let showsSeekBar: Bool

    var body: some View {
        HStack(spacing: 10) {
            Button {
                session.togglePlayback()
            } label: {
                StudioGlyph(session.isPlaying ? .pause : .play, size: 15)
            }
            .buttonStyle(StudioBarButtonStyle(isProminent: true))
            .disabled(session.project.clips.isEmpty)
            .help(session.isPlaying ? "Pause · Space" : "Play · Space")
            .accessibilityLabel(session.isPlaying ? "Pause" : "Play")

            PlaybackTimeReadout(clock: session.playbackClock, duration: session.duration)

            if showsSeekBar {
                FullScreenSeekBar(
                    clock: session.playbackClock,
                    duration: session.duration,
                    onScrub: session.scrub,
                    onFinish: session.finishScrubbing
                )
                .frame(minWidth: 220, maxWidth: .infinity)
            } else {
                Spacer(minLength: 0)
            }

            PreviewZoomControl(zoom: $zoom)

            Button {
                previewPresentation.toggleFullScreen()
            } label: {
                StudioGlyph(previewPresentation.isFullScreen ? .exitFullScreen : .fullScreen, size: 15)
            }
            .buttonStyle(StudioBarButtonStyle())
            .accessibilityLabel(
                previewPresentation.isFullScreen ? "Exit full screen" : "Watch preview full screen"
            )
            .help(previewPresentation.isFullScreen ? "Exit full screen" : "Watch preview full screen")

            Menu {
                ForEach(ProjectAspectRatio.allCases) { aspectRatio in
                    Button {
                        Task { await session.setAspectRatio(aspectRatio) }
                    } label: {
                        HStack {
                            Label(aspectRatio.title, systemImage: aspectSymbol(aspectRatio))
                            Spacer()
                            if session.project.selectedAspectRatio == aspectRatio {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                // AppKit draws a menu's label and keeps only its text and
                // images, so the glyphs go in as images.
                HStack(spacing: 6) {
                    StudioGlyph.image(.aspect, size: 15)
                    Text(session.project.selectedAspectRatio.title)
                    StudioGlyph.image(.chevronDown, size: 11)
                }
                .font(.studioLabelStrong)
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .fixedSize()
            .help("Frame shape for the preview and the export")
        }
        .padding(.horizontal, 12)
        .frame(height: TransportBarMetrics.height)
        .background(Color.panelBackground)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }

    private func aspectSymbol(_ aspectRatio: ProjectAspectRatio) -> String {
        switch aspectRatio {
        case .source: "rectangle.dashed"
        case .portrait: "rectangle.portrait"
        case .feedPortrait: "rectangle.portrait.inset.filled"
        case .square: "square"
        case .landscape: "rectangle"
        }
    }
}

/// Fullscreen has no timeline underneath it, so its transport owns one compact
/// scrubber. Clock observation is isolated here: playback can move the thumb
/// thirty times a second without rebuilding the zoom, aspect or window buttons.
private struct FullScreenSeekBar: View {
    @ObservedObject var clock: PlaybackClock
    let duration: Double
    let onScrub: (Double) -> Void
    let onFinish: (Double) -> Void
    @State private var draftTime: Double?

    var body: some View {
        Slider(
            value: scrubTime,
            in: 0 ... max(duration, 0.001),
            onEditingChanged: { editing in
                guard !editing else { return }
                let target = draftTime ?? min(clock.currentTime, duration)
                draftTime = nil
                onFinish(target)
            }
        )
        .controlSize(.small)
        .tint(Color.studioAccent)
        .disabled(duration <= 0)
        .accessibilityLabel("Preview position")
        .accessibilityValue(formatTimePrecise(draftTime ?? clock.currentTime))
        .help("Drag to seek through the preview")
    }

    private var scrubTime: Binding<Double> {
        Binding(
            get: { min(max(0, draftTime ?? clock.currentTime), max(duration, 0.001)) },
            set: { time in
                draftTime = time
                onScrub(time)
            }
        )
    }
}

func formatTimePrecise(_ seconds: Double) -> String {
    guard seconds.isFinite else { return "0:00.00" }
    let safe = max(0, seconds)
    let minutes = Int(safe) / 60
    let remainder = safe - Double(minutes * 60)
    return String(format: "%d:%05.2f", minutes, remainder)
}
