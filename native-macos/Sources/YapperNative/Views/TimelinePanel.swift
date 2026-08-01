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
                    TrackHeader(hasOverlays: session.project.overlays?.isEmpty == false)
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
            .offset(y: session.project.overlays?.isEmpty == false ? 105 : 45)

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
                            .offset(x: startX, y: 45)
                    }
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
                    .frame(width: 1.25, height: session.project.overlays?.isEmpty == false ? 193 : 133)
                    .overlay(alignment: .top) {
                        Circle().fill(Color.red).frame(width: 8, height: 8)
                    }
                    .offset(x: playheadX - 0.75, y: 30)
                    .allowsHitTesting(false)
            }

            Rectangle()
                .fill(.clear)
                .contentShape(Rectangle())
                .frame(width: contentWidth, height: session.project.overlays?.isEmpty == false ? 210 : 150)
                .offset(y: 25)
                .gesture(
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
        let start = min(peaks.count, max(0, Int(clip.sourceStart / media.duration * Double(peaks.count))))
        let end = min(peaks.count, max(start, Int(clip.sourceEnd / media.duration * Double(peaks.count))))
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
    let hasOverlays: Bool

    var body: some View {
        VStack(spacing: 0) {
            Color.clear.frame(height: 38)
            if hasOverlays {
                HStack(spacing: 7) {
                    Image(systemName: "photo.on.rectangle")
                    Text("Overlay")
                }
                .font(.studioCaptionStrong)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 56)
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
            Spacer()
        }
        .background(Color.panelBackground.opacity(0.72))
    }
}

private struct WaveformShape: View {
    let peaks: [Float]
    let color: Color

    var body: some View {
        Canvas { context, size in
            guard !peaks.isEmpty, size.width > 0 else { return }
            let columns = max(1, min(peaks.count, Int(size.width / 2)))
            let stride = max(1, peaks.count / columns)
            let middle = size.height / 2
            for column in 0 ..< columns {
                let start = column * stride
                let end = min(peaks.count, start + stride)
                guard start < end else { continue }
                let peak = peaks[start ..< end].max() ?? 0
                let height = max(1, CGFloat(peak) * size.height * 0.92)
                let x = CGFloat(column) / CGFloat(max(1, columns - 1)) * size.width
                var path = Path()
                path.move(to: CGPoint(x: x, y: middle - height / 2))
                path.addLine(to: CGPoint(x: x, y: middle + height / 2))
                context.stroke(path, with: .color(color), lineWidth: 1)
            }
        }
    }
}
