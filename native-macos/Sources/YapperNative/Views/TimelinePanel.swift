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

            HStack(alignment: .top, spacing: 2) {
                ForEach(session.project.clips) { clip in
                    if let media = session.project.media(for: clip) {
                        TimelineClipCell(
                            clip: clip,
                            media: media,
                            thumbnails: session.thumbnailsByMedia[media.id] ?? [],
                            peaks: session.waveformByMedia[media.id] ?? [],
                            waveformProgress: session.waveformProgressByMedia[media.id] ?? 0,
                            selected: session.selectedClipID == clip.id
                        )
                        .frame(
                            width: max(
                                3,
                                contentWidth * clip.duration / max(0.001, session.duration)
                            ),
                            height: 88
                        )
                        .onTapGesture { session.select(clip.id) }
                    }
                }
            }
            .fixedSize(horizontal: true, vertical: true)
            .frame(height: 88, alignment: .top)
            .offset(y: clipRowY)

            if let textLayers = session.project.textLayers, !textLayers.isEmpty {
                ForEach(textLayers) { layer in
                    let startX = contentWidth * layer.timelineStart / max(0.001, session.duration)
                    let width = max(18, contentWidth * layer.duration / max(0.001, session.duration))
                    Button {
                        session.selectTextLayer(layer.id)
                        session.scrub(to: layer.timelineStart)
                        session.finishScrubbing(at: layer.timelineStart)
                    } label: {
                        RoundedRectangle(cornerRadius: 5, style: .continuous)
                            .fill(Color(red: 0.42, green: 0.20, blue: 0.12).opacity(0.88))
                            .overlay(alignment: .leading) {
                                HStack(spacing: 5) {
                                    Image(systemName: "textformat")
                                    Text(layer.text.isEmpty ? "Text" : layer.text).lineLimit(1)
                                }
                                .font(.studioCaptionStrong)
                                .padding(.horizontal, 7)
                            }
                            .overlay {
                                RoundedRectangle(cornerRadius: 5, style: .continuous)
                                    .stroke(
                                        session.selectedTextLayerID == layer.id
                                            ? Color.yapperOrange.opacity(0.92)
                                            : Color.secondary.opacity(0.42),
                                        lineWidth: session.selectedTextLayerID == layer.id ? 1.15 : 0.7
                                    )
                            }
                    }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Text layer: \(layer.text)")
                        .frame(width: width, height: 42)
                        .offset(x: startX, y: textRowY)
                        .zIndex(3)
                }
            }

            if let overlays = session.project.overlays, !overlays.isEmpty {
                ForEach(overlays) { overlay in
                    if let media = session.project.media.first(where: { $0.id == overlay.mediaID }) {
                        let startX = contentWidth * overlay.timelineStart / max(0.001, session.duration)
                        let width = max(12, contentWidth * overlay.duration / max(0.001, session.duration))
                        RoundedRectangle(cornerRadius: 5, style: .continuous)
                            .fill(Color.yapperOrange.opacity(0.24))
                            .overlay(alignment: .leading) {
                                HStack(spacing: 5) {
                                    Image(systemName: "photo.on.rectangle")
                                    Text(media.name).lineLimit(1)
                                }
                                .font(.studioCaptionStrong)
                                .padding(.horizontal, 7)
                            }
                            .overlay {
                                RoundedRectangle(cornerRadius: 5, style: .continuous)
                                    .stroke(Color.yapperOrange.opacity(0.7), lineWidth: 1)
                            }
                            .frame(width: width, height: 42)
                            .offset(x: startX, y: overlayRowY)
                    }
                }
            }

            if let audioLayers = session.project.audioLayers, !audioLayers.isEmpty {
                ForEach(audioLayers) { layer in
                    let startX = contentWidth * layer.timelineStart / max(0.001, session.duration)
                    let width = max(24, contentWidth * layer.duration / max(0.001, session.duration))
                    Button {
                        session.selectAudioLayer(layer.id)
                        session.scrub(to: layer.timelineStart)
                        session.finishScrubbing(at: layer.timelineStart)
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
                            .padding(.horizontal, 7)
                        }
                        .overlay {
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .stroke(
                                    session.selectedAudioLayerID == layer.id
                                        ? Color.cyan.opacity(0.9)
                                        : Color.secondary.opacity(0.34),
                                    lineWidth: session.selectedAudioLayerID == layer.id ? 1.1 : 0.7
                                )
                        }
                    }
                    .buttonStyle(.plain)
                    .frame(width: width, height: 46)
                    .offset(x: startX, y: audioRowY)
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

            Rectangle()
                .fill(.clear)
                .contentShape(Rectangle())
                .frame(width: contentWidth, height: 88)
                .offset(y: clipRowY)
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
