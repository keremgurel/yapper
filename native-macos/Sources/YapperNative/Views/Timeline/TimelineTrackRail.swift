import SwiftUI

/// The rail down the left of the timeline: one row per track, carrying the
/// controls that belong to the whole track rather than to a clip on it.
///
/// Every row is the same shape — a glyph saying what the track is, then the
/// handful of switches that act on all of it. No names: "Overlay 2" and
/// "Captions" do not fit a rail this narrow and came out as "Overla…" and
/// "Caption s", and the glyph already says which track this is. The names live
/// in the tooltips, where a long word costs nothing.
///
/// Rows are laid out from the same measurements the cells beside them use, so a
/// row always sits next to its own track however many overlay lanes are in play.
struct TimelineTrackRail: View {
    /// Wide enough for a glyph and three switches without any of them being
    /// squeezed, and no wider — every point here is a point the timeline
    /// itself does not get.
    static let width: Double = 96

    @ObservedObject var session: EditorSession
    let layout: TimelineRowLayout

    var body: some View {
        VStack(spacing: 0) {
            // The rows are measured from a top that includes the ruler's
            // height, even though the ruler is drawn above the scroller, so the
            // rail reserves that space too. It has to be painted the same solid
            // colour the ruler's own rail column is: left translucent, this one
            // strip came out a different shade from the header directly above
            // it and read as a gap under the Timeline label.
            Color.panelBackground.frame(height: TimelineRowLayout.rulerHeight)

            if layout.hasText {
                TrackRailRow(glyph: "textformat", height: TimelineRowLayout.textRowHeight)
            }

            // Highest lane first: the rail reads the way the lanes composite.
            ForEach(overlayTracks, id: \.self) { track in
                overlayRow(track)
            }

            if layout.hasCaptions {
                captionRow
            }

            videoRow

            // One row per audio lane, so the rail stays a column of equals
            // beside the tracks it labels. Sounds stack when they overlap: see
            // AudioTracks.
            ForEach(0 ..< layout.audioTrackCount, id: \.self) { _ in
                TrackRailRow(glyph: "waveform", height: TimelineRowLayout.audioRowHeight)
            }

            Spacer(minLength: 0)
        }
        .background(Color.panelBackground.opacity(0.72))
    }

    private var overlayTracks: [Int] {
        guard layout.overlayTrackCount > 0 else { return [] }
        return Array((0 ..< layout.overlayTrackCount).reversed())
    }

    private func overlayRow(_ track: Int) -> some View {
        let hidden = session.isOverlayTrackHidden(track)
        let isEmpty = OverlayTracks.on(track, in: session.overlays).isEmpty
        return TrackRailRow(
            glyph: "photo.on.rectangle",
            height: TimelineRowLayout.overlayRowHeight
        ) {
            TrackControlButton(
                icon: hidden ? "eye.slash" : "eye",
                help: hidden ? "Show overlay lane \(track + 1)" : "Hide overlay lane \(track + 1)",
                isOn: !hidden
            ) {
                session.toggleOverlayTrackHidden(track)
            }
            .disabled(isEmpty)
            .opacity(isEmpty ? 0.35 : 1)

            TrackOverflowMenu(help: "More for overlay lane \(track + 1)") {
                Button(role: .destructive) {
                    Task { await session.removeOverlayTrack(track) }
                } label: {
                    Label("Delete lane \(track + 1)", systemImage: "trash")
                }
                .disabled(isEmpty)
            }
        }
    }

    private var captionRow: some View {
        TrackRailRow(
            glyph: "captions.bubble",
            height: TimelineRowLayout.captionRowHeight
        ) {
            TrackControlButton(
                icon: session.captionsVisible ? "eye" : "eye.slash",
                help: session.captionsVisible ? "Hide the captions" : "Show the captions",
                isOn: session.captionsVisible
            ) {
                Task { await session.toggleCaptions() }
            }
        }
    }

    private var videoRow: some View {
        TrackRailRow(
            glyph: "film",
            height: TimelineRowLayout.videoRowHeight,
            background: Color.studioFaintFill.opacity(0.55)
        ) {
            TrackControlButton(
                icon: session.project.isVideoTrackHidden ? "eye.slash" : "eye",
                help: session.project.isVideoTrackHidden ? "Show the video" : "Hide the video",
                isOn: !session.project.isVideoTrackHidden
            ) {
                session.toggleVideoTrackHidden()
            }
            // The mute is a switch and the fader is a level, which are two
            // different questions: "not right now" and "how much". Muting is
            // one press and stays one press; the fader lives one click deeper,
            // where it can be a full-sized slider rather than a stub of one
            // squeezed into a rail this narrow.
            TrackVolumeMenu(session: session, levels: session.audioLevels)
            TrackOverflowMenu(help: "More for the video track") {
                Button(role: .destructive) {
                    Task { await session.clearVideoTrack() }
                } label: {
                    Label("Remove every clip", systemImage: "trash")
                }
                .disabled(session.project.clips.isEmpty)
            }
        }
    }
}

/// One row of the rail: a glyph, then whatever acts on the whole track.
///
/// Fixed height and a hairline underneath, so the rail reads as a column of
/// equals rather than a stack of differently sized cards.
private struct TrackRailRow<Controls: View>: View {
    let glyph: String
    let height: Double
    var background: Color = .clear
    @ViewBuilder var controls: Controls

    init(
        glyph: String,
        height: Double,
        background: Color = .clear,
        @ViewBuilder controls: () -> Controls = { EmptyView() }
    ) {
        self.glyph = glyph
        self.height = height
        self.background = background
        self.controls = controls()
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: glyph)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.tertiary)
                .frame(width: 16)
            controls
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 6)
        .frame(maxWidth: .infinity, minHeight: height, alignment: .leading)
        .background(background)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }
}

/// The speaker's own fader, and the mute that goes with it.
///
/// In a popover because the rail is 96 points wide and a slider needs more than
/// that to be worth dragging. The glyph itself says what the level is, so the
/// popover is only ever opened to change something rather than to find out.
private struct TrackVolumeMenu: View {
    let session: EditorSession
    /// Watched, so the readout follows the handle rather than waiting for the
    /// drag to end.
    @ObservedObject var levels: AudioLevelDraft
    @State private var isOpen = false
    @State private var isHovering = false

    private var volume: Double { levels.mainTrack ?? session.project.resolvedVideoTrackVolume }
    private var isMuted: Bool { session.project.isVideoTrackMuted }

    var body: some View {
        Button {
            isOpen.toggle()
        } label: {
            Image(systemName: icon)
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 16, height: 18)
                .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .onHover { isHovering = $0 }
        .help("Volume for the video track · \(AudioLevel.percent(volume))%")
        .accessibilityLabel("Volume for the video track")
        .popover(isPresented: $isOpen, arrowEdge: .trailing) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Video track")
                    .font(.studioCaptionStrong)
                    .foregroundStyle(.secondary)
                VolumeSlider(
                    volume: volume,
                    onChange: { session.previewVideoTrackVolume($0) },
                    onCommit: { session.commitVideoTrackVolume() }
                )
                Toggle("Mute", isOn: Binding(
                    get: { isMuted },
                    set: { _ in session.toggleVideoTrackMuted() }
                ))
                .toggleStyle(.checkbox)
                .font(.studioCaption)
            }
            .padding(14)
            .frame(width: 320)
        }
    }

    private var icon: String {
        if isMuted { return "speaker.slash" }
        return switch AudioLevel.percent(volume) {
        case 0: "speaker.slash"
        case ..<60: "speaker.fill"
        case ..<110: "speaker.wave.2"
        default: "speaker.wave.3"
        }
    }

    private var tint: Color {
        // Anything but untouched is worth seeing at a glance: a track quietly
        // sitting at 30% is the reason a video sounds wrong.
        if isMuted || abs(volume - AudioLevel.unity) > 0.005 { return Color.yapperOrange }
        return isHovering ? Color.primary.opacity(0.85) : .secondary
    }
}

private struct TrackControlButton: View {
    let icon: String
    let help: String
    var isOn = true
    let action: () -> Void

    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 16, height: 18)
                .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .onHover { isHovering = $0 }
        .help(help)
        .accessibilityLabel(help)
    }

    private var tint: Color {
        // Off is the state worth seeing at a glance: a hidden track is the
        // reason something is missing from the picture.
        if !isOn { return Color.yapperOrange }
        return isHovering ? Color.primary.opacity(0.85) : .secondary
    }
}

/// The rest of a track's actions, kept behind a menu.
///
/// Deleting a whole track is one click away from the eye that hides one, so it
/// does not get to sit out here next to it.
private struct TrackOverflowMenu<Content: View>: View {
    let help: String
    @ViewBuilder let content: Content

    @State private var isHovering = false

    var body: some View {
        Menu {
            content
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(isHovering ? Color.primary.opacity(0.85) : .secondary)
                .frame(width: 16, height: 18)
                .contentShape(Rectangle())
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .clickableCursor()
        .onHover { isHovering = $0 }
        .help(help)
    }
}
