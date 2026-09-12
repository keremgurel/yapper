import AppKit
import SwiftUI

private struct MaskDraftKey: Identifiable, Equatable {
    let id = UUID()
    var time: Double
    var opacity: Double
    var easing: AnimationEase = .linear
}

struct MaskEditorSheet: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    let media: ProjectMedia
    let region: SavedRevealRegion?
    @Environment(\.dismiss) private var dismiss
    @State private var rect: OverlayCrop
    @State private var label: String
    @State private var color: Color
    @State private var animated: Bool
    @State private var keys: [MaskDraftKey]
    @State private var anchor: TimelineAnchorKind = .time
    @State private var anchorTime: Double = 0
    @State private var phrase = ""
    @State private var occurrence = 1
    @State private var timingEdited = false
    @State private var saving = false
    @State private var error: String?

    init(session: EditorSession, overlay: ProjectOverlay, media: ProjectMedia, region: SavedRevealRegion? = nil) {
        self.session = session; self.overlay = overlay; self.media = media; self.region = region
        _rect = State(initialValue: region.map { .init(x: $0.box.minX, y: $0.box.minY,
            width: $0.box.width, height: $0.box.height) } ?? .init(x: 0.25, y: 0.35, width: 0.5, height: 0.2))
        _label = State(initialValue: region?.label ?? "Hidden area")
        let background = region?.background ?? .white
        _color = State(initialValue: Color(.sRGB, red: background.red, green: background.green, blue: background.blue))
        _animated = State(initialValue: region?.opacityKeys != nil || region?.policy == .untilCue)
        let saved = region?.opacityKeys ?? region?.cueTime.map {
            [SavedMaskOpacityKey(time: $0, opacity: 1), .init(time: min($0 + 0.16, overlay.sourceStart + overlay.duration * overlay.resolvedPlaybackRate), opacity: 0)]
        } ?? []
        _keys = State(initialValue: saved.isEmpty
            ? [.init(time: overlay.timelineStart, opacity: 100), .init(time: overlay.timelineStart + min(1, overlay.duration), opacity: 0)]
            : saved.map { .init(time: overlay.timelineStart + ($0.time - overlay.sourceStart) / overlay.resolvedPlaybackRate,
                opacity: $0.opacity * 100, easing: $0.easing) })
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
            Toggle("Animate mask opacity", isOn: $animated)
            if animated {
                if region?.opacityKeys == nil && region?.policy == .untilCue && !timingEdited {
                    Text("The saved animation is preserved. Editing these keys replaces its timing and easing.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                AnimationAnchorEditor(kind: $anchor, time: $anchorTime, phrase: $phrase, occurrence: $occurrence)
                Text("Keyframe times are offsets from this cue. 100% covers the area; 0% exposes it.")
                    .font(.caption).foregroundStyle(.secondary)
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach($keys) { $key in
                            HStack {
                                Text("Time +")
                                TextField("Seconds", value: $key.time, format: .number.precision(.fractionLength(2))).frame(width: 70)
                                Text("Opacity %")
                                TextField("Opacity", value: $key.opacity, format: .number.precision(.fractionLength(0))).frame(width: 60)
                                Picker("Easing", selection: $key.easing) {
                                    Text("Linear").tag(AnimationEase.linear)
                                    Text("Smooth").tag(AnimationEase.smooth)
                                }.labelsHidden()
                                Button { keys.removeAll { $0.id == key.id } } label: { Image(systemName: "minus.circle") }
                                    .disabled(keys.count <= 2).help("Remove opacity keyframe")
                            }
                        }
                    }
                }.frame(maxHeight: 130)
                Button("Add keyframe") {
                    keys.append(.init(time: (keys.last?.time ?? 0) + 1, opacity: keys.last?.opacity ?? 100))
                }.disabled(keys.count >= 32)
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
        .onChange(of: animated) { _, _ in timingEdited = true }
        .onChange(of: keys) { _, _ in timingEdited = true }
        .onChange(of: anchor) { _, _ in timingEdited = true }
        .onChange(of: anchorTime) { _, _ in timingEdited = true }
        .onChange(of: phrase) { _, _ in timingEdited = true }
        .onChange(of: occurrence) { _, _ in timingEdited = true }
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
                    policy: timingEdited && !animated ? .alwaysHidden : nil, revealTime: nil,
                    opacityKeys: animated && (timingEdited || region == nil) ? keys.map {
                        .init(at: .init(kind: anchor, time: anchor == .time ? anchorTime : nil,
                            phrase: anchor == .phrase ? phrase : nil, occurrence: anchor == .phrase ? occurrence : nil,
                            eventID: nil, offset: $0.time), opacity: $0.opacity / 100, easing: $0.easing)
                    } : nil))
            }
            saving = false
            if result.status == .applied || result.status == .unchanged { dismiss() }
            else { error = result.message }
        }
    }
}
