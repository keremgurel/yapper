import SwiftUI

struct PlayerPanel: View {
    @ObservedObject var session: EditorSession
    let layoutMode: EditorLayoutMode
    /// How far the stage is pulled back from the panel. View state on purpose:
    /// it is how you are looking at the project, not part of it, and it has no
    /// business being saved or exported. See `PreviewZoom`.
    @State private var zoom: PreviewZoom = .fit
    /// Where a pinch started, so its factor is applied once rather than
    /// compounding on every step of the gesture.
    @State private var zoomAtPinchStart: PreviewZoom?

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
                                    .font(.system(size: 11))
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

            TransportBar(session: session, zoom: $zoom)
        }
        .background(Color.previewWorkspaceBackground)
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

    /// The saved position places the layer; the drag is carried as a transform
    /// on top. See CaptionCanvasOverlay for why.
    private var dragOffset: CGSize {
        guard let draft = drag.textDraft(for: layer.id) else { return .zero }
        return CGSize(
            width: (draft.x - layer.x) * canvasSize.width,
            height: (draft.y - layer.y) * canvasSize.height
        )
    }

    var body: some View {
        let displayed = drag.textDraft(for: layer.id) ?? layer
        AppearanceText(
            text: displayed.text.isEmpty ? "Text" : displayed.text,
            appearance: displayed.appearance,
            fontSize: max(11, canvasSize.height * displayed.fontScale),
            lineLimit: 5,
            minimumScaleFactor: 0.45
        )
            .frame(width: max(60, canvasSize.width * displayed.width))
            // The body takes its own clicks and drags before any decoration
            // goes on top. A hit shape applied after the corner handles cut
            // them off: they hang outside the box on purpose, so the shape
            // clipped exactly the part you reach for, and resizing stopped
            // working on every item at once.
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
                        if let finished = drag.endText() { session.updateTextLayer(finished) }
                        alignmentGuides = TextCanvasAlignmentGuides()
                    }
            )
            .overlay {
                if selected {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .stroke(Color.yapperOrange, style: StrokeStyle(lineWidth: 1.25, dash: [5, 3]))
                        .padding(-4)
                }
            }
            .overlay(alignment: .topLeading) {
                if selected { resizeHandle(.topLeading) }
            }
            .overlay(alignment: .topTrailing) {
                if selected { resizeHandle(.topTrailing) }
            }
            .overlay(alignment: .bottomLeading) {
                if selected { resizeHandle(.bottomLeading) }
            }
            .overlay(alignment: .bottomTrailing) {
                if selected { resizeHandle(.bottomTrailing) }
            }
            // Placed last: `position` hands back a view the size of the whole
            // canvas, so anything after it would claim the lot.
            .position(
                x: canvasSize.width * layer.x,
                y: canvasSize.height * layer.y
            )
            .offset(dragOffset)
    }

    private func resizeHandle(_ corner: CanvasResizeCorner) -> some View {
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
            .fill(Color.white)
            .overlay {
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .stroke(Color.yapperOrange, lineWidth: 1.5)
            }
            .frame(width: 9, height: 9)
            .offset(x: corner.xOffset, y: corner.yOffset)
            .contentShape(Rectangle().inset(by: -8))
            .cursor(.crosshair)
            .highPriorityGesture(
                // The handle travels with the corner it is resizing, so it can
                // no more measure against itself than the layer can.
                DragGesture(minimumDistance: 0, coordinateSpace: .named(CanvasCoordinateSpace.stage))
                    .onChanged { value in
                        if drag.textOrigin?.id != layer.id {
                            drag.beginText(layer)
                            if !selected { session.selectTextLayer(layer.id) }
                        }
                        guard let origin = drag.textOrigin else { return }
                        let updated = TextCanvasGeometry.resized(
                            layer: origin,
                            translation: value.translation,
                            corner: corner,
                            canvasSize: canvasSize
                        )
                        drag.updateText(updated)
                    }
                    .onEnded { _ in
                        if let finished = drag.endText() { session.updateTextLayer(finished) }
                    }
            )
            .accessibilityLabel("Resize text from \(corner.accessibilityName)")
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
        var x = min(0.96, max(0.04, origin.x + translation.width / width))
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

    static func resized(
        layer: ProjectTextLayer,
        translation: CGSize,
        corner: CanvasResizeCorner,
        canvasSize: CGSize
    ) -> ProjectTextLayer {
        var updated = layer
        let projected = (
            Double(translation.width) * corner.xSign
                + Double(translation.height) * corner.ySign
        ) / 2
        let referenceWidth = max(72, Double(canvasSize.width) * layer.width)
        let scale = min(3.2, max(0.35, 1 + projected / referenceWidth))
        let newWidth = min(0.95, max(0.16, layer.width * scale))
        let newFontScale = min(0.16, max(0.018, layer.fontScale * scale))

        // Keep the opposite corner visually anchored while the dragged corner moves.
        updated.x = min(0.96, max(0.04, layer.x + (newWidth - layer.width) * corner.xSign / 2))
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

private struct TransportBar: View {
    @ObservedObject var session: EditorSession
    @Binding var zoom: PreviewZoom

    var body: some View {
        HStack(spacing: 10) {
            Button {
                session.togglePlayback()
            } label: {
                Image(systemName: session.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 13, weight: .bold))
                    .frame(width: 30, height: 30)
            }
            .buttonStyle(.studioPlain)
            .background(Color.studioFaintFill)
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .disabled(session.project.clips.isEmpty)

            PlaybackTimeReadout(clock: session.playbackClock, duration: session.duration)

            Spacer()

            PreviewZoomControl(zoom: $zoom)

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
                HStack(spacing: 6) {
                    Image(systemName: "aspectratio")
                    Text(session.project.selectedAspectRatio.title)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(.secondary)
                }
                .font(.system(size: 11, weight: .semibold))
                .padding(.horizontal, 9)
                .frame(height: 28)
                .background(Color.studioFaintFill)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(Color.studioLine, lineWidth: 1)
                }
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .fixedSize()
            .help("Frame ratio for preview and export")
        }
        .padding(.horizontal, 14)
        .frame(height: 40)
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

func formatTimePrecise(_ seconds: Double) -> String {
    guard seconds.isFinite else { return "0:00.00" }
    let safe = max(0, seconds)
    let minutes = Int(safe) / 60
    let remainder = safe - Double(minutes * 60)
    return String(format: "%d:%05.2f", minutes, remainder)
}
