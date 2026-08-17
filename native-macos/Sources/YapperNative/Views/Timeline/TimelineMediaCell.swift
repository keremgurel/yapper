import CoreGraphics
import SwiftUI

/// The look of a piece of footage on the timeline: thumbnail strip, scrims,
/// name badge, and a waveform when the row is tall enough to carry one.
///
/// Shared by the main video track and the overlay track. A clip promoted to an
/// overlay is the same footage on a different row, so it has to read as the
/// same thing rather than collapsing into an anonymous coloured pill.
struct TimelineMediaCell: View {
    let name: String
    let sourceStart: Double
    let sourceEnd: Double
    let mediaDuration: Double
    let thumbnails: [CGImage]
    let peaks: [Float]
    let waveformProgress: Double
    let height: CGFloat
    let selected: Bool
    /// Border colour when the cell is not selected, so the overlay row can
    /// carry its own accent while still showing real footage.
    var idleBorder: Color = .white.opacity(0.30)
    var badgeIcon: String?
    /// What the track this sits on is playing at, so the waveform agrees with
    /// the mix. Cutaways carry no sound of their own, so they leave it alone.
    var volume: Double = 1
    /// Portion of the cell that is on screen (plus the viewport's preload
    /// margin). Keeping the default preserves small overlay cells, while long
    /// main-track clips opt into viewport-windowed drawing.
    var visibleFraction: ClosedRange<Double> = 0 ... 1

    /// Below this the waveform has no room to read, so the row shows footage
    /// and its name only.
    private var showsWaveform: Bool { height >= 60 }

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color(red: 0.12, green: 0.15, blue: 0.16)
                if !thumbnails.isEmpty, visibleWidth(in: proxy.size.width) > 0 {
                    TimelineThumbnailStrip(
                        thumbnails: thumbnails,
                        width: visibleWidth(in: proxy.size.width),
                        height: height,
                        sourceStart: visibleSourceStart,
                        sourceEnd: visibleSourceEnd,
                        mediaDuration: mediaDuration
                    )
                    .frame(
                        width: visibleWidth(in: proxy.size.width),
                        height: height
                    )
                    .offset(x: visibleOffset(in: proxy.size.width))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .opacity(0.72)
                }
                // Scrims both ends: the badge rides the top and the waveform the
                // bottom, and a thumbnail can be bright at either. The middle
                // stays clear so the frame itself still reads.
                LinearGradient(
                    stops: [
                        .init(color: .black.opacity(0.62), location: 0),
                        .init(color: .clear, location: showsWaveform ? 0.36 : 0.62),
                        .init(color: .black.opacity(0.58), location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                if showsWaveform {
                    waveformLayer(cellWidth: proxy.size.width)
                }
                nameBadge
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .offset(x: visibleOffset(in: proxy.size.width))
                    .opacity(proxy.size.width > 65 ? 1 : 0)
            }
            .clipped()
            .overlay(
                RoundedRectangle(cornerRadius: 5)
                    .stroke(
                        selected ? Color.yapperOrange : idleBorder,
                        lineWidth: selected ? 1.6 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 5))
        }
    }

    private func waveformLayer(cellWidth: CGFloat) -> some View {
        let window = visibleWaveformWindow
        let width = visibleWidth(in: cellWidth)
        return WaveformShape(
            peaks: peaks,
            sampleRange: window.range,
            color: Color.cyan.opacity(0.95),
            gain: AudioLevel.waveformGain(volume)
        )
        .padding(.horizontal, 2)
        .padding(.bottom, 2)
        .frame(height: 30)
        .frame(width: max(0, width * window.fraction), alignment: .leading)
        .offset(x: visibleOffset(in: cellWidth))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
    }

    private var nameBadge: some View {
        HStack(spacing: 4) {
            if let badgeIcon {
                Image(systemName: badgeIcon)
                    .font(.system(size: 9, weight: .bold))
            }
            Text(name).lineLimit(1)
        }
        .font(.system(size: 10, weight: .semibold))
        // Pinned to white rather than the scheme's primary colour: it sits over
        // video frames, not over the app background.
        .foregroundStyle(Color.white.opacity(0.96))
        .padding(.horizontal, 5)
        .padding(.vertical, 2)
        // A badge rather than bare text: it gives each clip a visible start
        // marker, so a run of cuts from one source no longer reads as a single
        // long strip.
        .background(Color.black.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
        .padding(4)
    }

    private var visibleWaveformWindow: TimelineWaveformWindow {
        TimelineWaveformGeometry.window(
            peakCount: peaks.count,
            progress: waveformProgress,
            sourceStart: visibleSourceStart,
            sourceEnd: visibleSourceEnd,
            mediaDuration: mediaDuration
        )
    }

    private var clampedVisibleFraction: ClosedRange<Double> {
        min(1, max(0, visibleFraction.lowerBound))
            ... min(1, max(0, visibleFraction.upperBound))
    }

    private var visibleSourceStart: Double {
        sourceStart + (sourceEnd - sourceStart) * clampedVisibleFraction.lowerBound
    }

    private var visibleSourceEnd: Double {
        sourceStart + (sourceEnd - sourceStart) * clampedVisibleFraction.upperBound
    }

    private func visibleOffset(in width: CGFloat) -> CGFloat {
        width * clampedVisibleFraction.lowerBound
    }

    private func visibleWidth(in width: CGFloat) -> CGFloat {
        width * max(0, clampedVisibleFraction.upperBound - clampedVisibleFraction.lowerBound)
    }
}

/// Thumbnails keep a constant on-screen size while the timeline zooms, so the
/// strip never looks stretched or cropped as the scale changes.
struct TimelineThumbnailStrip: View {
    let thumbnails: [CGImage]
    let width: CGFloat
    let height: CGFloat
    let sourceStart: Double
    let sourceEnd: Double
    let mediaDuration: Double

    /// Tiles keep the 74x88 proportion the video track was designed around, so
    /// a shorter row shows narrower frames instead of squashed ones.
    private var tileWidth: CGFloat { max(18, height * 74 / 88) }

    private static let spacing: CGFloat = 1

    var body: some View {
        HStack(spacing: Self.spacing) {
            ForEach(0 ..< tileCount, id: \.self) { tile in
                Image(decorative: thumbnails[thumbnailIndex(for: tile)], scale: 1)
                    .resizable()
                    .scaledToFill()
                    .frame(width: drawnTileWidth, height: height)
                    .clipped()
            }
        }
        .frame(width: width, height: height, alignment: .leading)
        .clipped()
        // A picture of the clip, not a control. Every tile was its own
        // accessibility element, and a long timeline is thousands of them:
        // anything asking the window for its accessibility tree, a screen
        // recorder or a dictation tool, made SwiftUI rebuild all of it on every
        // update. Sampled during a pane drag, that was the most expensive thing
        // in the app.
        .accessibilityHidden(true)
    }

    /// How many frames fit, rounded to the nearest rather than up.
    ///
    /// Rounding up meant a cell only a little wider than one tile laid out two
    /// of them and had the second sliced off by the clip. On the video track,
    /// where cells are long, that last sliver is lost in a run of frames; on a
    /// short overlay it is most of the cell, and it read as an overlay whose
    /// end had been cut off.
    private var tileCount: Int {
        max(1, min(1_200, Int((width / (tileWidth + Self.spacing)).rounded())))
    }

    /// The tiles share out the width exactly, so the strip ends flush with the
    /// cell. A frame is cropped to its tile rather than stretched, so spending
    /// a few points either side of the ideal width only changes how much of the
    /// picture shows, never its shape.
    private var drawnTileWidth: CGFloat {
        let count = CGFloat(tileCount)
        return max(1, (width - Self.spacing * (count - 1)) / count)
    }

    private func thumbnailIndex(for tile: Int) -> Int {
        guard thumbnails.count > 1, mediaDuration > 0 else { return 0 }
        let tileFraction = (Double(tile) + 0.5) / Double(tileCount)
        let sourceTime = sourceStart + max(0, sourceEnd - sourceStart) * tileFraction
        let mediaFraction = min(0.999, max(0, sourceTime / mediaDuration))
        return min(thumbnails.count - 1, Int(mediaFraction * Double(thumbnails.count)))
    }
}
