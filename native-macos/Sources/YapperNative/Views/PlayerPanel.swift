import SwiftUI

struct PlayerPanel: View {
    @ObservedObject var session: EditorSession
    let layoutMode: EditorLayoutMode

    var body: some View {
        VStack(spacing: 0) {
            GeometryReader { proxy in
                let stageSize = fittedStageSize(in: proxy.size)
                ZStack {
                    Color.previewWorkspaceBackground
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
                            NativePlayerView(player: session.player)
                                .id(ObjectIdentifier(session.player))
                        }

                        TextLayerCanvasOverlay(session: session)
                    }
                    .frame(width: stageSize.width, height: stageSize.height)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .shadow(color: .black.opacity(0.52), radius: 16, y: 6)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .stroke(Color.previewCanvasBorder, lineWidth: 1)
                    )
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(layoutMode == .standard ? 18 : 10)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            TransportBar(session: session)
        }
        .background(Color.previewWorkspaceBackground)
    }

    private func fittedStageSize(in container: CGSize) -> CGSize {
        let inset: CGFloat = layoutMode == .standard ? 36 : 20
        let available = CGSize(
            width: max(1, container.width - inset),
            height: max(1, container.height - inset)
        )
        let aspect = CGFloat(session.project.resolvedAspectRatio)
        if available.width / available.height > aspect {
            return CGSize(width: available.height * aspect, height: available.height)
        }
        return CGSize(width: available.width, height: available.width / aspect)
    }
}

private struct TextLayerCanvasOverlay: View {
    @ObservedObject var session: EditorSession
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
                        alignmentGuides: $alignmentGuides
                    )
                }

                TextCanvasGuideOverlay(guides: alignmentGuides)
                    .allowsHitTesting(false)
                    .zIndex(20)
            }
        }
    }

    private var visibleLayers: [ProjectTextLayer] {
        (session.project.textLayers ?? []).filter { $0.isVisible(at: session.currentTime) }
    }
}

private struct TextLayerCanvasItem: View {
    @ObservedObject var session: EditorSession
    let layer: ProjectTextLayer
    let canvasSize: CGSize
    let selected: Bool
    @Binding var alignmentGuides: TextCanvasAlignmentGuides
    @State private var dragOrigin: CGPoint?
    @State private var resizeOrigin: ProjectTextLayer?
    @State private var interactionLayer: ProjectTextLayer?

    var body: some View {
        let displayed = interactionLayer ?? layer
        Text(displayed.text.isEmpty ? "Text" : displayed.text)
            .font(previewFont(for: displayed))
            .fontWeight(.bold)
            .multilineTextAlignment(.center)
            .foregroundStyle(foregroundColor(for: displayed))
            .lineLimit(5)
            .minimumScaleFactor(0.45)
            .padding(.horizontal, displayed.style == .plain ? 4 : 14)
            .padding(.vertical, displayed.style == .plain ? 4 : 10)
            .frame(width: max(60, canvasSize.width * displayed.width))
            .background(background(for: displayed))
            .shadow(
                color: displayed.style == .plain ? .black.opacity(0.72) : .clear,
                radius: displayed.style == .plain ? 2 : 0,
                y: 1
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
            .position(
                x: canvasSize.width * displayed.x,
                y: canvasSize.height * displayed.y
            )
            .contentShape(Rectangle())
            .onTapGesture { session.selectTextLayer(layer.id) }
            .gesture(
                DragGesture(minimumDistance: 1)
                    .onChanged { value in
                        if dragOrigin == nil {
                            dragOrigin = CGPoint(x: layer.x, y: layer.y)
                            session.selectTextLayer(layer.id)
                        }
                        guard let dragOrigin else { return }
                        let result = TextCanvasGeometry.moved(
                            layer: layer,
                            origin: dragOrigin,
                            translation: value.translation,
                            canvasSize: canvasSize
                        )
                        alignmentGuides = result.guides
                        interactionLayer = result.layer
                    }
                    .onEnded { _ in
                        if let interactionLayer { session.updateTextLayer(interactionLayer) }
                        interactionLayer = nil
                        dragOrigin = nil
                        alignmentGuides = TextCanvasAlignmentGuides()
                    }
            )
    }

    private func resizeHandle(_ corner: TextResizeCorner) -> some View {
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
            .fill(Color.white)
            .overlay {
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .stroke(Color.yapperOrange, lineWidth: 1.5)
            }
            .frame(width: 9, height: 9)
            .offset(x: corner.xOffset, y: corner.yOffset)
            .contentShape(Rectangle().inset(by: -7))
            .highPriorityGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        if resizeOrigin == nil {
                            resizeOrigin = layer
                            session.selectTextLayer(layer.id)
                        }
                        guard let resizeOrigin else { return }
                        let updated = TextCanvasGeometry.resized(
                            layer: resizeOrigin,
                            translation: value.translation,
                            corner: corner,
                            canvasSize: canvasSize
                        )
                        interactionLayer = updated
                    }
                    .onEnded { _ in
                        if let interactionLayer { session.updateTextLayer(interactionLayer) }
                        interactionLayer = nil
                        resizeOrigin = nil
                    }
            )
            .accessibilityLabel("Resize text from \(corner.accessibilityName)")
    }

    private func previewFont(for layer: ProjectTextLayer) -> Font {
        let size = max(11, canvasSize.height * layer.fontScale)
        switch layer.font {
        case .modern:
            return .system(size: size, weight: .bold, design: .default)
        case .rounded:
            return .system(size: size, weight: .bold, design: .rounded)
        case .editorial:
            return .system(size: size, weight: .bold, design: .serif)
        }
    }

    private func foregroundColor(for layer: ProjectTextLayer) -> Color {
        layer.style == .whiteCard ? .black : .white
    }

    @ViewBuilder
    private func background(for layer: ProjectTextLayer) -> some View {
        switch layer.style {
        case .plain:
            Color.clear
        case .whiteCard:
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.white.opacity(0.96))
        case .blackCard:
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.black.opacity(0.9))
        }
    }
}

struct TextCanvasAlignmentGuides: Equatable {
    var verticalCenter = false
    var horizontalCenter = false
}

enum TextResizeCorner: Sendable {
    case topLeading
    case topTrailing
    case bottomLeading
    case bottomTrailing

    var xSign: Double {
        switch self {
        case .topLeading, .bottomLeading: -1
        case .topTrailing, .bottomTrailing: 1
        }
    }

    var ySign: Double {
        switch self {
        case .topLeading, .topTrailing: -1
        case .bottomLeading, .bottomTrailing: 1
        }
    }

    var xOffset: CGFloat { CGFloat(xSign) * 7 }
    var yOffset: CGFloat { CGFloat(ySign) * 7 }

    var accessibilityName: String {
        switch self {
        case .topLeading: "top left"
        case .topTrailing: "top right"
        case .bottomLeading: "bottom left"
        case .bottomTrailing: "bottom right"
        }
    }
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
        corner: TextResizeCorner,
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

    var body: some View {
        HStack(spacing: 10) {
            Button {
                session.togglePlayback()
            } label: {
                Image(systemName: session.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 13, weight: .bold))
                    .frame(width: 30, height: 30)
            }
            .buttonStyle(.plain)
            .background(Color.studioFaintFill)
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .disabled(session.project.clips.isEmpty)

            Text("\(formatTimePrecise(session.currentTime)) / \(formatTimePrecise(session.duration))")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(.secondary)

            Spacer()

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
