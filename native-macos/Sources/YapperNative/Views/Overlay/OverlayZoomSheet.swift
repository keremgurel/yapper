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
        VStack(alignment: .leading, spacing: 16) {
            Text("Zoom into overlay").font(.title2.bold())
            Text("Move and resize the rectangle around the section to focus on. The overlay stays in place while its contents zoom.")
                .foregroundStyle(.secondary)
            if let media = session.media(for: overlay) {
                CropCanvas(image: session.overlaySourceImage(media), mediaAspect: CompositionBuilder.aspect(of: media),
                    crop: target, aspectRatio: currentCrop.width / currentCrop.height,
                    onCommit: { target = $0 })
                    .frame(maxWidth: .infinity, maxHeight: 330)
            }
            HStack {
                timeField("Start", value: $start)
                timeField("Arrive", value: $end)
            }
            Text("Seconds into this overlay · smooth start and finish").font(.caption).foregroundStyle(.secondary)
            Toggle("Zoom back out", isOn: $returns)
            if returns {
                HStack {
                    timeField("Start returning", value: $returnStart)
                    timeField("Finish returning", value: $returnEnd)
                }
            }
            if let error { Text(error).foregroundStyle(.red).font(.caption) }
            HStack {
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
                Spacer()
                Button(saving ? "Saving…" : "Add zoom keyframes") { save() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(saving)
            }
        }
        .padding(24)
        .frame(width: 640)
        .interactiveDismissDisabled(saving)
    }

    private var currentCrop: OverlayCrop { OverlayKeyTrack.crop(of: overlay, at: start) }

    private func timeField(_ label: String, value: Binding<Double>) -> some View {
        HStack { Text(label); TextField(label, value: value, format: .number.precision(.fractionLength(2))).frame(width: 82) }
    }

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
