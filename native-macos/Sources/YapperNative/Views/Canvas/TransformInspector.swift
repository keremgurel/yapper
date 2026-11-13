import SwiftUI

/// Scale and position for the speaker's own picture, with a keyframe on each.
///
/// The canvas is where you frame a shot by eye, and it is the wrong place to
/// build a move: a push-in is two moments and the line between them, and you
/// cannot see two moments at once. So the numbers live here, next to the
/// diamond that marks the moment, and the two halves of the gesture are one
/// panel apart rather than one panel and a guess.
///
/// The keyframe controls follow the shape every editor uses: an arrow back to
/// the previous key, a diamond that is filled when you are standing on one, an
/// arrow forward to the next.
struct TransformInspector: View {
    @ObservedObject var session: EditorSession
    /// Watched so the numbers follow a drag on the canvas as it happens.
    @ObservedObject var drag: CanvasDragState
    /// Watched so they also follow the playhead, which is what makes a keyed
    /// clip readable: park on each key and the panel says what it holds.
    @ObservedObject var clock: PlaybackClock

    @State private var showsFramingAnimation = false

    private var framing: VideoFraming { session.displayedFraming }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            speedSection
            Divider().opacity(0.45)
            InspectorSection(
                "Framing",
                id: "video.position",
                accessory: AnyView(ApplyToAllButton(what: "scale and position", count: session.otherClipCount) {
                    session.applyFramingToAllClips()
                })
            ) {
                essentials
                positionRow
                rotationRow
                if session.isFramingKeyed { keyframeSummary }
            }
            .disabled(session.framingClip?.locked == true)
            Divider().opacity(0.45)
            InspectorSection(
                "Background",
                id: "video.background",
                accessory: AnyView(ApplyToAllButton(what: "background", count: session.otherClipCount) {
                    session.applyBackgroundToAllClips()
                })
            ) {
                backgroundRow
                if session.removesBackground { backdropRow }
            }
            Divider().opacity(0.45)
            RetouchInspector(session: session, clock: clock)
        }
    }

    private var speedSection: some View {
        InspectorSection(
            "Clip",
            id: "video.clip",
            accessory: session.speedClip.map { clip in
                AnyView(ApplyToAllButton(what: "speed", count: session.otherClipCount) {
                    Task { await session.setClipSpeed(clip.resolvedPlaybackRate, applyToAll: true) }
                })
            }
        ) {
            if let clip = session.speedClip {
                // The speeds people actually pick, one click each, with the
                // field beside them for anything in between. The full list
                // used to sit in a dropdown, two clicks from every answer.
                InspectorRow("Speed", detail: "Type any speed from 0.25× to 4×. Pitch stays the same.") {
                    InspectorSegmentedControl(
                        options: ClipSpeed.quickPresets.map { .init(value: $0, label: ClipSpeed.label($0)) },
                        selection: clip.resolvedPlaybackRate,
                        onSelect: { rate in Task { await session.setClipSpeed(rate) } }
                    )
                    .disabled(clip.locked || session.project.media(for: clip)?.isImage != false)
                    InspectorNumberField(value: clip.resolvedPlaybackRate, range: ClipSpeed.range, decimals: 2) { rate in
                        Task { await session.setClipSpeed(rate) }
                    }
                    .disabled(clip.locked || session.project.media(for: clip)?.isImage != false)
                }
                .help("Playback speed from 0.25× to 4×; the number field accepts a custom speed.")
                .disabled(!session.appActions.availability(.clipSpeed, in: session).isAvailable)
                InspectorRow("Lock") {
                    Button {
                        Task { await session.toggleTimelineLock(.clip(clip.id)) }
                    } label: {
                        Label(clip.locked ? "Unlock clip" : "Lock clip", systemImage: clip.locked ? "lock.fill" : "lock.open")
                    }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    .disabled(!session.appActions.availability(.timelineLock, in: session).isAvailable)
                }
            }
        }
    }

    /// Keeping or throwing away the room behind the speaker.
    private var backgroundRow: some View {
        InspectorRow("Room", detail: session.removesBackground ? "Only you are kept" : "The whole picture is kept") {
            InspectorSegmentedControl(
                options: [
                    .init(value: BackgroundChoice.keep, label: "Keep"),
                    .init(value: BackgroundChoice.remove, label: "Remove"),
                ],
                selection: session.removesBackground ? .remove : .keep
            ) { choice in
                session.setBackgroundRemoved(choice == .remove)
            }
        }
    }

    /// What shows once the room is gone. A colour and nothing else: a
    /// photograph or a video behind the speaker is a full-frame overlay set to
    /// sit behind them, which is a control that already exists.
    private var backdropRow: some View {
        InspectorRow("Behind", alignment: .top) {
            VStack(alignment: .leading, spacing: 8) {
                LazyVGrid(columns: BackdropSwatchGrid.columns, alignment: .leading, spacing: 6) {
                    BackdropSwatch(name: "Colour", selected: preset == nil) {
                        guard preset != nil else { return }
                        session.setBackdropPreset(nil)
                    } picture: {
                        session.backdrop.swiftUIColor
                    }
                    ForEach(BackdropPreset.allCases) { option in
                        BackdropSwatch(name: option.title, selected: preset == option) {
                            guard preset != option else { return }
                            session.setBackdropPreset(option)
                        } picture: {
                            BackdropPresetPicture(
                                preset: option,
                                colors: preset == option ? session.project.backdropPresetColors : nil
                            )
                        }
                    }
                }
                if preset == nil {
                    InspectorColorWell(color: session.backdrop) { color, live in
                        session.setBackdrop(color, live: live)
                    }
                }
                Text(preset.map { "\($0.title) behind you" } ?? "A colour, or a full-frame overlay behind you")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                if let preset {
                    BackdropColorControls(preset: preset, colors: session.project.backdropPresetColors) { colors in
                        session.setBackdropPresetColors(colors)
                    }
                    .padding(.top, 4)
                }
            }
        }
    }

    private var preset: BackdropPreset? { session.project.backdropPreset }

    /// Scale and the keyframe row, always on screen: the size of the shot is
    /// what anyone opens this panel for, and the diamond has to be next to the
    /// thing it records.
    @ViewBuilder
    private var essentials: some View {
            InspectorRow("Scale") {
                InspectorSlider(
                    value: Double(framing.percent),
                    range: VideoFraming.minimumScale * 100 ... VideoFraming.maximumScale * 100,
                    decimals: 0
                ) { percent in
                    session.setFramingScale(percent / 100)
                }
            }

            InspectorRow(
                "Keyframe",
                detail: session.isFramingKeyed ? "This shot moves" : "Mark where a move starts, then change the scale later on"
            ) {
                KeyframeControls(session: session, clock: clock)
                Button("Animate framing") { session.pausePlayback(); showsFramingAnimation = true }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    .sheet(isPresented: $showsFramingAnimation) {
                        VideoAnimationSheet(session: session, playhead: session.currentTime)
                    }
            }
    }

    private var positionRow: some View {
        InspectorRow("Offset") {
            // In percent of the frame, the same units the box on the canvas is
            // measured in. Pixels would mean something different for every
            // aspect ratio the project could be exported at.
            HStack(spacing: 7) {
                Text("X").font(.studioCaption).foregroundStyle(.secondary)
                InspectorNumberField(
                    value: (framing.x * 100).rounded(),
                    range: -150 ... 150,
                    decimals: 0
                ) { percent in
                    session.setFramingOffset(x: percent / 100, y: framing.y)
                }
                Text("Y").font(.studioCaption).foregroundStyle(.secondary)
                InspectorNumberField(
                    value: (framing.y * 100).rounded(),
                    range: -150 ... 150,
                    decimals: 0
                ) { percent in
                    session.setFramingOffset(x: framing.x, y: percent / 100)
                }
            }
        }
    }

    /// Which way up the picture is. Footage shot sideways is the reason this
    /// exists, so the quarter turns are one press each and the number field is
    /// there for the slight tilt nobody can hit with a drag.
    private var rotationRow: some View {
        InspectorRow("Rotate") {
            HStack(spacing: 7) {
                InspectorNumberField(
                    value: framing.rotation.rounded(),
                    range: -180 ... 180,
                    decimals: 0
                ) { degrees in
                    session.setFramingRotation(degrees)
                }
                Text("°").font(.studioCaption).foregroundStyle(.secondary)

                quarterTurn("rotate.left", degrees: -90, help: "Turn left")
                quarterTurn("rotate.right", degrees: 90, help: "Turn right")

                if framing.rotation != 0 {
                    Button("Straighten") { session.setFramingRotation(0) }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                }
            }
        }
    }

    private func quarterTurn(_ icon: String, degrees: Double, help: String) -> some View {
        Button {
            session.turnFraming(by: degrees)
        } label: {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .frame(width: 24, height: 22)
                .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .help(help)
    }

    private var keyframeSummary: some View {
        InspectorRow("Move", detail: summary) {
            Button("Clear keyframes") { session.clearFramingKeys() }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
        }
    }

    private var summary: String {
        let count = session.framingKeys.count
        return count == 1
            ? "1 keyframe · move the playhead and change the scale"
            : "\(count) keyframes"
    }
}

/// Back a key, add or remove one here, forward a key.
private struct KeyframeControls: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var clock: PlaybackClock

    var body: some View {
        HStack(spacing: 2) {
            arrow("chevron.left", enabled: session.hasPreviousFramingKey) {
                session.goToPreviousFramingKey()
            }
            .help("Previous keyframe")

            Button {
                session.toggleFramingKey()
            } label: {
                Image(systemName: isOnKey ? "diamond.fill" : "diamond")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isOnKey ? Color.studioAccent : Color.secondary)
                    .frame(width: 24, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .disabled(session.project.clips.isEmpty)
            .help(isOnKey ? "Remove this keyframe" : "Add a keyframe here")

            arrow("chevron.right", enabled: session.hasNextFramingKey) {
                session.goToNextFramingKey()
            }
            .help("Next keyframe")
        }
    }

    private var isOnKey: Bool { session.framingKeyAtPlayhead != nil }

    private func arrow(
        _ icon: String,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .bold))
                .frame(width: 18, height: 22)
                .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .disabled(!enabled)
    }
}

/// Whether the room behind the speaker is kept or thrown away.
private enum BackgroundChoice: Hashable {
    case keep
    case remove
}
