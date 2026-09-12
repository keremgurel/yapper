import AppKit
import SwiftUI

struct MaskEditorSheet: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    let media: ProjectMedia
    let region: SavedRevealRegion?
    @Environment(\.dismiss) private var dismiss
    @State private var rect: OverlayCrop
    @State private var label: String
    @State private var color: Color
    @State private var policy: RevealPolicy
    @State private var revealTime: Double
    @State private var saving = false
    @State private var error: String?

    init(session: EditorSession, overlay: ProjectOverlay, media: ProjectMedia, region: SavedRevealRegion? = nil) {
        self.session = session; self.overlay = overlay; self.media = media; self.region = region
        _rect = State(initialValue: region.map { .init(x: $0.box.minX, y: $0.box.minY,
            width: $0.box.width, height: $0.box.height) } ?? .init(x: 0.25, y: 0.35, width: 0.5, height: 0.2))
        _label = State(initialValue: region?.label ?? "Hidden area")
        let background = region?.background ?? .white
        _color = State(initialValue: Color(.sRGB, red: background.red, green: background.green, blue: background.blue))
        _policy = State(initialValue: region?.policy ?? .alwaysHidden)
        _revealTime = State(initialValue: region?.cueTime.map { ($0 - overlay.sourceStart) / overlay.resolvedPlaybackRate }
            ?? min(max(0, session.currentTime - overlay.timelineStart), max(0, overlay.duration - 0.2)))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(region == nil ? "Mask an area" : "Edit mask").font(.title2.bold())
            Text("Move and resize the rectangle over the area to hide. The original image stays intact.")
                .foregroundStyle(.secondary)
            CropCanvas(image: session.overlaySourceImage(media), mediaAspect: CompositionBuilder.aspect(of: media),
                       crop: rect, minimumSide: 0.005, onCommit: { rect = $0 })
                .frame(maxWidth: .infinity, maxHeight: 320)
            HStack {
                TextField("Mask name", text: $label)
                ColorPicker("Cover color", selection: $color, supportsOpacity: false)
            }
            HStack {
                dimension("Left", keyPath: \.x)
                dimension("Top", keyPath: \.y)
                dimension("Width", keyPath: \.width)
                dimension("Height", keyPath: \.height)
            }
            Picker("Visibility", selection: $policy) {
                Text("Always hidden").tag(RevealPolicy.alwaysHidden)
                Text("Reveal at time").tag(RevealPolicy.untilCue)
                Text("Always visible").tag(RevealPolicy.alwaysVisible)
            }
            if policy == .untilCue {
                HStack {
                    Text("Reveal")
                    TextField("Reveal time", value: $revealTime, format: .number.precision(.fractionLength(2))).frame(width: 80)
                    Text("seconds into this overlay").foregroundStyle(.secondary)
                    Button("Use playhead") {
                        revealTime = max(0, session.currentTime - overlay.timelineStart)
                    }
                }
            }
            if let error { Text(error).foregroundStyle(.red).font(.caption) }
            HStack {
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
                if region != nil { Button("Remove mask", role: .destructive) { save(removing: true) }.disabled(saving) }
                Spacer()
                Button(saving ? "Saving…" : "Save mask") { save() }
                    .keyboardShortcut(.defaultAction).disabled(saving || label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(24).frame(width: 680).interactiveDismissDisabled(saving)
    }

    private func dimension(_ name: String, keyPath: WritableKeyPath<OverlayCrop, Double>) -> some View {
        HStack(spacing: 4) {
            Text(name).font(.caption)
            TextField(name, value: Binding(get: { rect[keyPath: keyPath] * 100 },
                set: { rect[keyPath: keyPath] = $0 / 100 }), format: .number.precision(.fractionLength(1)))
                .frame(width: 48)
            Text("%").font(.caption).foregroundStyle(.secondary)
        }
    }

    private func save(removing: Bool = false) {
        saving = true
        Task {
            let result: AppActionResult
            if removing, let region {
                result = await session.performAppAction(MaskRemoveInput(overlayID: overlay.id, regionID: region.id))
            } else {
                let rgb = NSColor(color).usingColorSpace(.sRGB) ?? .white
                result = await session.performAppAction(MaskRegionInput(overlayID: overlay.id, regionID: region?.id,
                    label: label.trimmingCharacters(in: .whitespacesAndNewlines), rect: rect.actionRect,
                    red: rgb.redComponent, green: rgb.greenComponent, blue: rgb.blueComponent,
                    policy: policy, revealTime: policy == .untilCue ? revealTime : nil))
            }
            saving = false
            if result.status == .applied || result.status == .unchanged { dismiss() }
            else { error = result.message }
        }
    }
}
