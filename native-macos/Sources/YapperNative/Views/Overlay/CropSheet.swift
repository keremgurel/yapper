import SwiftUI

/// Cropping, given the window.
///
/// The inspector's crop well is 260 points wide, which is fine for checking a
/// crop and miserable for making one: the corners are a few points apart and
/// the picture is too small to see what you are cutting off. This is the same
/// editor with room to aim in, opened from wherever the file is: the bin, the
/// timeline, or the inspector.
struct CropSheet: View {
    @ObservedObject var session: EditorSession
    let request: CropRequest

    /// Each completed gesture is saved as an undoable edit.
    @State private var crop: OverlayCrop
    @State private var aspect: CropAspect = .free
    @State private var targetID: UUID?
    @State private var localTime: Double

    init(session: EditorSession, request: CropRequest) {
        self.session = session
        self.request = request
        _crop = State(initialValue: request.crop)
        _targetID = State(initialValue: request.overlayIDs.first)
        _localTime = State(initialValue: request.keyTime ?? 0)
    }

    private var mediaAspect: Double {
        session.project.media
            .first { $0.id == request.mediaID }
            .map(CompositionBuilder.aspect(of:)) ?? 1
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            Divider()

            controls

            scopeControls

            ZStack {
                Color.black.opacity(0.88)

                CropCanvas(
                    image: session.thumbnailsByMedia[request.mediaID]?.first,
                    mediaAspect: mediaAspect,
                    crop: crop,
                    aspectRatio: fractionRatio,
                    onChange: { crop = $0 },
                    onCommit: { committed in
                        crop = committed
                        session.applyCrop(committed, to: activeRequest)
                    }
                )
                .padding(28)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay {
                Rectangle()
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    .allowsHitTesting(false)
            }

            Divider()

            footer
        }
        .frame(minWidth: 780, idealWidth: 920, minHeight: 620, idealHeight: 760)
        .background(Color.panelBackground)
        .onChange(of: target?.keys) { _, _ in
            if let target { crop = OverlayKeyTrack.crop(of: target, at: localTime) }
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(request.name)
                    .font(.studioSectionTitle)
                    .lineLimit(2)
                Text(targetID == nil ? "Every portion gets this crop, replacing any crop animation." : "Only this portion changes. The others keep their crop.")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 12)

            Text(readout)
                .font(.studioTimecode)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.studioTray, in: Capsule())
                .help("How much of the picture's width and height is kept")
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 15)
    }

    private var controls: some View {
        HStack(spacing: 14) {
            rowLabel("Shape")

            InspectorSegmentedControl(
                options: CropAspect.allCases.map { .init(value: $0, label: $0.title) },
                selection: aspect
            ) { chosen in
                aspect = chosen
                apply(chosen)
            }

            Spacer(minLength: 12)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 11)
    }

    private var footer: some View {
        HStack(spacing: 9) {
            Button("Reset") {
                crop = .full
                aspect = .free
                session.applyCrop(.full, to: activeRequest)
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(crop.isFull)
            .help("Show the whole picture again")

            Text("Drag inside the box to move it. Drag an edge or corner to resize it.")
                .font(.studioCaption)
                .foregroundStyle(Color.studioTextMuted)

            Spacer(minLength: 0)

            Button("Done") { session.endCropping() }
                .buttonStyle(EditorPrimaryButtonStyle(size: .small))
                .keyboardShortcut(.defaultAction)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    /// One column for the three row labels, so their controls start on the
    /// same edge.
    private static let labelWidth: CGFloat = 64

    private func rowLabel(_ title: String) -> some View {
        Text(title)
            .font(.studioCaption)
            .foregroundStyle(Color.studioTextMuted)
            .frame(width: Self.labelWidth, alignment: .leading)
    }

    private var readout: String {
        "\(Int((crop.width * 100).rounded()))% wide · \(Int((crop.height * 100).rounded()))% tall"
    }

    private var fractionRatio: Double? {
        guard let realRatio = aspect.ratio(sourceAspect: mediaAspect) else { return nil }
        return CropGeometry.fractionRatio(forRealRatio: realRatio, sourceAspect: mediaAspect)
    }

    private func apply(_ selectedAspect: CropAspect) {
        guard selectedAspect != .free else { return }
        let ratio = selectedAspect.ratio(sourceAspect: mediaAspect).flatMap {
            CropGeometry.fractionRatio(forRealRatio: $0, sourceAspect: mediaAspect)
        }
        let fitted = CropGeometry.maximized(
            crop,
            to: ratio,
            minimumSide: OverlayCrop.minimumSide
        )
        guard fitted != crop else { return }
        crop = fitted
        session.applyCrop(fitted, to: activeRequest)
    }

    private var portions: [ProjectOverlay] { session.overlays(ofMedia: request.mediaID) }
    private var target: ProjectOverlay? { portions.first { $0.id == targetID } }
    private var supportsCropKeys: Bool {
        session.project.media.contains { $0.id == request.mediaID }
    }

    private var activeRequest: CropRequest {
        CropRequest(mediaID: request.mediaID, name: request.name,
                    overlayIDs: targetID.map { [$0] } ?? portions.map(\.id),
                    crop: crop, keyTime: targetID != nil && supportsCropKeys ? localTime : nil)
    }

    private var scopeControls: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 14) {
                rowLabel("Applies to")
                Picker("Overlay portion", selection: $targetID) {
                    ForEach(Array(portions.enumerated()), id: \.element.id) { index, portion in
                        Text("Portion \(index + 1) · \(formatTime(portion.timelineStart)) · \(String(format: "%.1fs", portion.duration))")
                            .tag(Optional(portion.id))
                    }
                    if portions.count > 1 {
                        Text("All \(portions.count) portions, same crop").tag(nil as UUID?)
                    }
                }
                .labelsHidden()
                .fixedSize()
                .onChange(of: targetID) { _, _ in
                    aspect = .free
                    if let target {
                        localTime = min(localTime, target.duration)
                        crop = OverlayKeyTrack.crop(of: target, at: localTime)
                        session.seekToTimelineTime(target.timelineStart + localTime)
                    } else {
                        crop = CropRequest.make(mediaID: request.mediaID, name: request.name, overlays: portions)?.crop ?? .full
                    }
                }
                Spacer()
                if let target, supportsCropKeys {
                    Button {
                        session.seekToTimelineTime(target.timelineStart + localTime)
                        session.toggleOverlayKey(target)
                    } label: {
                        Label(OverlayKeyTrack.key(of: target, at: localTime) == nil ? "Add keyframe" : "Remove keyframe",
                              systemImage: OverlayKeyTrack.key(of: target, at: localTime) == nil ? "diamond" : "diamond.fill")
                    }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                }
            }
            if let target, supportsCropKeys {
                HStack(spacing: 14) {
                    Text(String(format: "%.2fs", localTime))
                        .font(.studioTimecode)
                        .foregroundStyle(Color.studioTextMuted)
                        .frame(width: Self.labelWidth, alignment: .leading)
                    Slider(value: $localTime, in: 0...max(0.001, target.duration))
                        .accessibilityLabel("Time within this overlay portion")
                        .onChange(of: localTime) { _, time in
                            crop = OverlayKeyTrack.crop(of: target, at: time)
                            session.seekToTimelineTime(target.timelineStart + time)
                        }
                    Text(OverlayKeyTrack.isKeyed(target) ? "Cropping here adds a keyframe" : "Add a keyframe to animate the crop, then scrub and crop")
                        .font(.studioCaption).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 12)
    }
}
