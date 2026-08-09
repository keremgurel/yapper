import SwiftUI

/// The size, position and timing of the selected overlay, for the times when
/// dragging it on the canvas is not exact enough.
///
/// Laid out like every other properties panel: what you reach for constantly is
/// on screen, Position is called Position, and Timing sits at the bottom under
/// that name here, on a text layer and on a caption alike.
struct OverlayInspectorView: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay

    private var media: ProjectMedia? { session.media(for: overlay) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            essentials

            Divider()

            InspectorSection("Position", id: "overlay.position") {
                InspectorRow("Fit") {
                    InspectorSegmentedControl(
                        options: [
                            .init(value: OverlayFit.card, label: "Card"),
                            .init(value: OverlayFit.full, label: "Full frame"),
                        ],
                        selection: OverlayFrame.isFullFrame(overlay) ? .full : .card
                    ) { fit in
                        switch fit {
                        case .full: session.fillFrameWithOverlay(overlay)
                        case .card: session.resetOverlayFrame(overlay)
                        }
                    }
                }

                InspectorRow("Size") {
                    InspectorSlider(
                        value: overlay.width * 100,
                        range: 6 ... 140,
                        decimals: 0
                    ) { percent in
                        session.scaleOverlay(overlay, toWidth: percent / 100)
                    }
                }

                InspectorRow("Position") {
                    HStack(spacing: 7) {
                        Text("X").font(.studioCaption).foregroundStyle(.secondary)
                        InspectorNumberField(
                            value: overlay.x * 100,
                            range: -20 ... 120,
                            decimals: 0
                        ) { percent in
                            commit { $0.x = OverlayCanvasGeometry.clampedOrigin(percent / 100, extent: overlay.width) }
                        }
                        Text("Y").font(.studioCaption).foregroundStyle(.secondary)
                        InspectorNumberField(
                            value: overlay.y * 100,
                            range: -20 ... 120,
                            decimals: 0
                        ) { percent in
                            commit { $0.y = OverlayCanvasGeometry.clampedOrigin(percent / 100, extent: overlay.height) }
                        }
                    }
                }
            }

            Divider()

            InspectorSection("Timing", id: "overlay.timing") {
                InspectorRow("Start") {
                    InspectorNumberField(
                        value: overlay.timelineStart,
                        range: 0 ... max(0, session.duration),
                        decimals: 2,
                        width: 58
                    ) { start in
                        commit {
                            $0.timelineStart = start
                            $0.duration = min($0.duration, max(0.1, session.duration - start))
                        }
                    }
                    Text("seconds").font(.studioCaption).foregroundStyle(.secondary)
                }

                InspectorRow("Length") {
                    InspectorNumberField(
                        value: overlay.duration,
                        range: 0.1 ... max(0.1, session.duration),
                        decimals: 2,
                        width: 58
                    ) { length in
                        commit {
                            $0.duration = min(length, max(0.1, session.duration - overlay.timelineStart))
                        }
                    }
                    Text("seconds").font(.studioCaption).foregroundStyle(.secondary)
                }

                if let media, !media.isImage {
                    InspectorRow("Source") {
                        InspectorNumberField(
                            value: overlay.sourceStart,
                            range: 0 ... max(0, media.duration),
                            decimals: 2,
                            width: 58
                        ) { start in
                            commit { $0.sourceStart = start }
                        }
                        Text("seconds into \(media.name)")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }

            Divider()

            HStack(spacing: 8) {
                Button {
                    session.revealOverlay(overlay)
                } label: {
                    Label("Go to", systemImage: "smallcircle.filled.circle")
                }
                .buttonStyle(EditorSecondaryButtonStyle())

                Button(role: .destructive) {
                    Task { await session.deleteOverlay(overlay.id) }
                } label: {
                    Label("Remove", systemImage: "trash")
                }
                .buttonStyle(EditorSecondaryButtonStyle())

                Spacer(minLength: 0)

                if let media {
                    Text(media.isImage ? "Image overlay" : "Video cutaway")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.top, 10)
        }
    }

    /// Cropping lives in its own window, reached from here, from the bin and
    /// from the timeline. It used to be a 260-point well folded into this
    /// panel as well, which meant two ways to crop that behaved differently and
    /// one of them was too small to aim in. See `CropSheet`.
    private var essentials: some View {
        VStack(alignment: .leading, spacing: 9) {
            InspectorRow("Keyframe") {
                OverlayKeyframeControls(session: session, overlay: overlay)
                Text(keyframeSummary)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            InspectorRow("Crop") {
                HStack(spacing: 8) {
                    Button("Crop…") { session.beginCropping(overlayID: overlay.id) }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .mini))

                    Text(cropReadout)
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()

                    if !overlay.resolvedCrop.isFull {
                        Button("Reset") { session.setOverlayCrop(overlay, crop: .full) }
                            .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    }
                }
            }
        }
        .padding(.vertical, 10)
    }

    private var keyframeSummary: String {
        let keys = session.overlayKeys(overlay)
        switch keys.count {
        case 0: return "Mark the start of a move"
        case 1: return "1 keyframe · move the playhead and drag the card"
        default: return "\(keys.count) keyframes"
        }
    }

    private var cropReadout: String {
        let crop = overlay.resolvedCrop
        guard !crop.isFull else { return "Whole picture" }
        return "\(Int((crop.width * 100).rounded()))% × \(Int((crop.height * 100).rounded()))%"
    }

    private func commit(_ change: (inout ProjectOverlay) -> Void) {
        var updated = overlay
        change(&updated)
        session.commitOverlayEdit(updated)
    }
}

private enum OverlayFit: Hashable {
    case card
    case full
}
