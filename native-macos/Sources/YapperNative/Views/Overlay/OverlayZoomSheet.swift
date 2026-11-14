import AppKit
import SwiftUI

struct OverlayZoomSheet: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    @Environment(\.dismiss) private var dismiss
    @State private var target: OverlayCrop
    @State private var start: Double
    @State private var end: Double
    @State private var returns = false
    @State private var returnStart: Double
    @State private var returnEnd: Double
    @State private var saving = false
    @State private var error: String?

    init(session: EditorSession, overlay: ProjectOverlay) {
        self.session = session; self.overlay = overlay
        let start = min(max(0, session.currentTime - overlay.timelineStart), max(0, overlay.duration - 0.6))
        let crop = OverlayKeyTrack.crop(of: overlay, at: start)
        _target = State(initialValue: .init(x: crop.x + crop.width / 4, y: crop.y + crop.height / 4,
                                           width: crop.width / 2, height: crop.height / 2))
        _start = State(initialValue: start)
        _end = State(initialValue: min(overlay.duration, start + 0.6))
        _returnStart = State(initialValue: max(start + 0.8, overlay.duration - 0.6))
        _returnEnd = State(initialValue: overlay.duration)
    }

    var body: some View {
        StudioSheet(
            title: "Zoom into overlay",
            detail: "Move and resize the rectangle around the part to focus on. The overlay stays where it is while its picture zooms.",
            confirmTitle: "Add zoom keyframes",
            isWorking: saving,
            error: error,
            onCancel: { dismiss() },
            onConfirm: save
        ) {
            if let media = session.media(for: overlay) {
                CropCanvas(image: session.overlaySourceImage(media), mediaAspect: CompositionBuilder.aspect(of: media),
                    crop: target, aspectRatio: currentCrop.width / currentCrop.height,
                    onCommit: { target = $0 })
                    .frame(maxWidth: .infinity, maxHeight: 330)
            }
            HStack(alignment: .bottom, spacing: 12) {
                StudioSheetNumberField(label: "Start zooming at", value: $start, unit: "s")
                StudioSheetNumberField(label: "Arrive at", value: $end, unit: "s")
                Text("Seconds into this overlay. The zoom eases in and out.")
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 6)
            }
            StudioSheetSwitchRow(title: "Zoom back out afterwards", isOn: $returns)
            if returns {
                HStack(alignment: .bottom, spacing: 12) {
                    StudioSheetNumberField(label: "Start returning at", value: $returnStart, unit: "s")
                    StudioSheetNumberField(label: "Back to normal at", value: $returnEnd, unit: "s")
                }
            }
        }
    }

    private var currentCrop: OverlayCrop { OverlayKeyTrack.crop(of: overlay, at: start) }

    private func save() {
        saving = true
        Task {
            let result = await session.performAppAction(OverlayZoomInput(overlayID: overlay.id, target: target.actionRect,
                startTime: start, endTime: end, returnStart: returns ? returnStart : nil, returnEnd: returns ? returnEnd : nil))
            saving = false
            if result.status == .applied || result.status == .unchanged { dismiss() }
            else { error = result.message }
        }
    }
}
