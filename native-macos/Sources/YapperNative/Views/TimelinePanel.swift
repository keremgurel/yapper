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
                Slider(value: $pointsPerSecond, in: 18 ... 180)
                    .frame(width: 130)
                    .controlSize(.mini)
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
                    }
                }
            }
        }
        .background(Color.editorBackground)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }
}

private struct TimelineContent: View {
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
            TimelineRuler(duration: session.duration, width: contentWidth)
                .frame(height: 34)

            TimelineVideoTrack(session: session, contentWidth: contentWidth)
            .fixedSize(horizontal: true, vertical: true)
            .frame(height: 88, alignment: .top)
            .offset(y: clipRowY)

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

            // Scrubbing belongs to the ruler and base media track. Keeping the
            // scrub surface out of text/overlay rows lets those layers receive
            // their own clicks, drags, and future trim handles.
            Rectangle()
                .fill(.clear)
                .contentShape(Rectangle())
                .frame(width: contentWidth, height: 20)
                .offset(y: 25)
                .zIndex(1)
                .gesture(scrubGesture)

        }
    }

    private var scrubGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { value in
                let time = TimelineMetrics.time(
                    for: value.location.x,
                    duration: session.duration,
                    width: contentWidth
                )
                if let hit = session.project.clip(at: time) {
                    session.select(session.project.clips[hit.index].id)
                }
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
        HStack(alignment: .top, spacing: 2) {
            ForEach(session.project.clips) { clip in
                if let media = session.project.media(for: clip) {
                    TimelineVideoClipItem(
                        session: session,
                        clip: clip,
                        media: media,
                        thumbnails: session.thumbnailsByMedia[media.id] ?? [],
                        peaks: session.waveformByMedia[media.id] ?? [],
                        waveformProgress: session.waveformProgressByMedia[media.id] ?? 0,
                        timelineStart: session.project.timelineStart(of: clip.id) ?? 0,
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
    let timelineStart: Double
    let contentWidth: Double
    let selected: Bool
    @State private var trimOrigin: TimelineClip?
    @State private var trimDraft: TimelineClip?

    var body: some View {
        let displayed = trimDraft ?? clip
        let displayedWidth = max(
            3,
            contentWidth * displayed.duration / max(0.001, session.duration)
        )
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
        .gesture(scrubGesture(displayed: displayed, displayedWidth: displayedWidth))
        .overlay(alignment: .leading) {
            if selected { trimHandle(edge: .leading) }
        }
        .overlay(alignment: .trailing) {
            if selected { trimHandle(edge: .trailing) }
        }
    }

    private func trimHandle(edge: HorizontalEdge) -> some View {
        TimelineTrimHandle(color: .cyan, height: 70)
            .highPriorityGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        if trimOrigin == nil {
                            trimOrigin = clip
                            session.select(clip.id)
                        }
                        guard let trimOrigin else { return }
                        trimDraft = TimelineClipGeometry.trimmed(
                            clip: trimOrigin,
                            edge: edge,
                            translationX: value.translation.width,
                            contentWidth: contentWidth,
                            projectDuration: session.duration,
                            mediaDuration: media.duration
                        )
                    }
                    .onEnded { _ in
                        guard let trimDraft else {
                            trimOrigin = nil
                            return
                        }
                        Task {
                            await session.commitClipTrim(trimDraft)
                            self.trimDraft = nil
                            trimOrigin = nil
                        }
                    }
            )
            .help(edge == .leading ? "Extend or trim clip start" : "Extend or trim clip end")
    }

    private func scrubGesture(displayed: TimelineClip, displayedWidth: Double) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard trimOrigin == nil else { return }
                session.select(clip.id)
                let fraction = min(1, max(0, value.location.x / max(1, displayedWidth)))
                session.scrub(to: timelineStart + displayed.duration * fraction)
            }
            .onEnded { value in
                guard trimOrigin == nil else { return }
                let fraction = min(1, max(0, value.location.x / max(1, displayedWidth)))
                session.finishScrubbing(at: timelineStart + displayed.duration * fraction)
            }
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
        let delta = Double(translationX) / contentWidth * projectDuration
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
    let color: Color
    let height: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
            .fill(Color.white.opacity(0.96))
            .overlay {
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .stroke(color, lineWidth: 1.25)
            }
            .frame(width: 6, height: height)
            .padding(.horizontal, 2)
            .contentShape(Rectangle().inset(by: -6))
    }
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

    var body: some View {
        let displayed = trimDraft ?? overlay
        let startX = contentWidth * displayed.timelineStart / max(0.001, session.duration)
        let width = max(12, contentWidth * displayed.duration / max(0.001, session.duration))
        Button {
            session.selectOverlay(overlay.id)
            session.scrub(to: displayed.timelineStart)
            session.finishScrubbing(at: displayed.timelineStart)
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
        .overlay(alignment: .leading) {
            if selected { trimHandle(.leading) }
        }
        .overlay(alignment: .trailing) {
            if selected { trimHandle(.trailing) }
        }
        .frame(width: width, height: 42)
        .offset(x: startX, y: rowY)
    }

    private func trimHandle(_ edge: HorizontalEdge) -> some View {
        TimelineTrimHandle(color: .yapperOrange, height: 28)
            .highPriorityGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        if trimOrigin == nil {
                            trimOrigin = overlay
                            session.selectOverlay(overlay.id)
                        }
                        guard let trimOrigin else { return }
                        trimDraft = TimelineOverlayGeometry.trimmed(
                            overlay: trimOrigin,
                            edge: edge,
                            translationX: value.translation.width,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
                        )
                    }
                    .onEnded { _ in
                        if let trimDraft { session.commitOverlayTrim(trimDraft) }
                        trimDraft = nil
                        trimOrigin = nil
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

    var body: some View {
        let displayed = trimDraft ?? layer
        let startX = contentWidth * displayed.timelineStart / max(0.001, session.duration)
        let width = max(24, contentWidth * displayed.duration / max(0.001, session.duration))
        Button {
            session.selectAudioLayer(layer.id)
            session.scrub(to: displayed.timelineStart)
            session.finishScrubbing(at: displayed.timelineStart)
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
        .overlay(alignment: .leading) {
            if selected { trimHandle(.leading) }
        }
        .overlay(alignment: .trailing) {
            if selected { trimHandle(.trailing) }
        }
        .frame(width: width, height: 46)
        .offset(x: startX, y: rowY)
    }

    private func trimHandle(_ edge: HorizontalEdge) -> some View {
        TimelineTrimHandle(color: .cyan, height: 32)
            .highPriorityGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        if trimOrigin == nil {
                            trimOrigin = layer
                            session.selectAudioLayer(layer.id)
                        }
                        guard let trimOrigin else { return }
                        trimDraft = TimelineAudioGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: value.translation.width,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
                        )
                    }
                    .onEnded { _ in
                        guard let trimDraft else {
                            trimOrigin = nil
                            return
                        }
                        Task {
                            await session.commitAudioTrim(trimDraft)
                            self.trimDraft = nil
                            trimOrigin = nil
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
        let delta = Double(translationX) / contentWidth * projectDuration
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
        let delta = Double(translationX) / contentWidth * projectDuration
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

    var body: some View {
        let displayed = trimDraft ?? layer
        let startX = contentWidth * displayed.timelineStart / max(0.001, session.duration)
        let width = max(18, contentWidth * displayed.duration / max(0.001, session.duration))
        Button {
            session.selectTextLayer(displayed.id)
            session.scrub(to: displayed.timelineStart)
            session.finishScrubbing(at: displayed.timelineStart)
        } label: {
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
        }
        .buttonStyle(.plain)
        .overlay(alignment: .leading) {
            if selected { trimHandle(edge: .leading) }
        }
        .overlay(alignment: .trailing) {
            if selected { trimHandle(edge: .trailing) }
        }
        .frame(width: width, height: 42)
        .offset(x: startX, y: rowY)
    }

    private func trimHandle(edge: HorizontalEdge) -> some View {
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
            .fill(Color.white.opacity(0.96))
            .overlay {
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .stroke(Color.yapperOrange, lineWidth: 1)
            }
            .frame(width: 5, height: 28)
            .padding(.horizontal, 2)
            .contentShape(Rectangle().inset(by: -5))
            .highPriorityGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        if trimOrigin == nil {
                            trimOrigin = layer
                            session.selectTextLayer(layer.id)
                        }
                        guard let trimOrigin else { return }
                        trimDraft = TimelineTextGeometry.trimmed(
                            layer: trimOrigin,
                            edge: edge,
                            translationX: value.translation.width,
                            contentWidth: contentWidth,
                            projectDuration: session.duration
                        )
                    }
                    .onEnded { _ in
                        if let trimDraft { session.updateTextLayer(trimDraft) }
                        trimDraft = nil
                        trimOrigin = nil
                    }
            )
            .help(edge == .leading ? "Trim text start" : "Extend or trim text end")
    }
}

enum TimelineTextGeometry {
    static func trimmed(
        layer: ProjectTextLayer,
        edge: HorizontalEdge,
        translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double
    ) -> ProjectTextLayer {
        var updated = layer
        guard projectDuration > 0, contentWidth > 0 else { return updated }
        let delta = Double(translationX) / contentWidth * projectDuration
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
            let step = niceStep(approximateStep)
            var time = 0.0
            while time <= duration + 0.001 {
                let x = TimelineMetrics.x(for: time, duration: duration, width: size.width)
                var path = Path()
                path.move(to: CGPoint(x: x, y: 20))
                path.addLine(to: CGPoint(x: x, y: 30))
                context.stroke(path, with: .color(.white.opacity(0.18)), lineWidth: 1)
                context.draw(
                    Text(formatTime(time))
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(.secondary),
                    at: CGPoint(x: x + 3, y: 10),
                    anchor: .leading
                )
                time += step
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
                    peaks: slicedPeaks(),
                    color: .cyan.opacity(0.95)
                )
                .padding(.horizontal, 2)
                .padding(.bottom, 2)
                .frame(height: 30)
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
                        selected ? Color.yapperOrange.opacity(0.9) : Color.secondary.opacity(0.34),
                        lineWidth: selected ? 1.25 : 0.75
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 5))
        }
    }

    private func slicedPeaks() -> [Float] {
        guard !peaks.isEmpty, media.duration > 0 else { return [] }
        let estimatedTotal = waveformProgress > 0 && waveformProgress < 1
            ? max(peaks.count, Int(ceil(Double(peaks.count) / waveformProgress)))
            : peaks.count
        let start = min(peaks.count, max(0, Int(clip.sourceStart / media.duration * Double(estimatedTotal))))
        let end = min(peaks.count, max(start, Int(clip.sourceEnd / media.duration * Double(estimatedTotal))))
        return Array(peaks[start ..< end])
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
    let color: Color

    var body: some View {
        Canvas { context, size in
            guard !peaks.isEmpty, size.width > 0 else { return }
            let barWidth: CGFloat = 1.5
            let barGap: CGFloat = 1
            let step = barWidth + barGap
            let columns = max(1, min(peaks.count, Int(ceil(size.width / step))))
            let stride = max(1, peaks.count / columns)
            let middle = size.height / 2
            for column in 0 ..< columns {
                let start = column * stride
                let end = min(peaks.count, start + stride)
                guard start < end else { continue }
                let peak = peaks[start ..< end].max() ?? 0
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
