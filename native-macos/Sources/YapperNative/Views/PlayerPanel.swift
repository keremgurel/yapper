import SwiftUI

struct PlayerPanel: View {
    @ObservedObject var session: EditorSession
    let layoutMode: EditorLayoutMode

    var body: some View {
        VStack(spacing: 0) {
            GeometryReader { proxy in
                let stageSize = fittedStageSize(in: proxy.size)
                ZStack {
                    Color.editorBackground
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
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(Color.studioLine, lineWidth: 1)
                    )
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(layoutMode == .standard ? 18 : 10)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            TransportBar(session: session)
        }
        .background(Color.editorBackground)
    }

    private func fittedStageSize(in container: CGSize) -> CGSize {
        let inset: CGFloat = layoutMode == .standard ? 36 : 20
        let available = CGSize(
            width: max(1, container.width - inset),
            height: max(1, container.height - inset)
        )
        let aspect = layoutMode.previewAspectRatio
        if available.width / available.height > aspect {
            return CGSize(width: available.height * aspect, height: available.height)
        }
        return CGSize(width: available.width, height: available.width / aspect)
    }
}

private struct TextLayerCanvasOverlay: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        GeometryReader { proxy in
            ForEach(visibleLayers) { layer in
                TextLayerCanvasItem(
                    session: session,
                    layer: layer,
                    canvasSize: proxy.size,
                    selected: session.selectedTextLayerID == layer.id
                )
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
    @State private var dragOrigin: CGPoint?

    var body: some View {
        Text(layer.text.isEmpty ? "Text" : layer.text)
            .font(previewFont)
            .fontWeight(.bold)
            .multilineTextAlignment(.center)
            .foregroundStyle(foregroundColor)
            .lineLimit(5)
            .minimumScaleFactor(0.45)
            .padding(.horizontal, layer.style == .plain ? 4 : 14)
            .padding(.vertical, layer.style == .plain ? 4 : 10)
            .frame(width: max(60, canvasSize.width * layer.width))
            .background(background)
            .shadow(
                color: layer.style == .plain ? .black.opacity(0.72) : .clear,
                radius: layer.style == .plain ? 2 : 0,
                y: 1
            )
            .overlay {
                if selected {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .stroke(Color.yapperOrange, style: StrokeStyle(lineWidth: 1.25, dash: [5, 3]))
                        .padding(-4)
                }
            }
            .position(
                x: canvasSize.width * layer.x,
                y: canvasSize.height * layer.y
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
                        var updated = layer
                        updated.x = min(0.96, max(0.04, dragOrigin.x + value.translation.width / max(1, canvasSize.width)))
                        updated.y = min(0.94, max(0.06, dragOrigin.y + value.translation.height / max(1, canvasSize.height)))
                        session.updateTextLayer(updated)
                    }
                    .onEnded { _ in dragOrigin = nil }
            )
    }

    private var previewFont: Font {
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

    private var foregroundColor: Color {
        layer.style == .whiteCard ? .black : .white
    }

    @ViewBuilder
    private var background: some View {
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

            Button {
                Task { await session.splitAtPlayhead() }
            } label: {
                Label("Split", systemImage: "scissors")
            }
            .buttonStyle(EditorSecondaryButtonStyle())
            .disabled(session.project.clips.isEmpty)

            Button {
                Task { await session.deleteSelected() }
            } label: {
                Label("Delete", systemImage: "trash")
            }
            .buttonStyle(EditorSecondaryButtonStyle())
            .disabled(session.selectedClipID == nil)
        }
        .padding(.horizontal, 14)
        .frame(height: 48)
        .background(Color.panelBackground)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
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
