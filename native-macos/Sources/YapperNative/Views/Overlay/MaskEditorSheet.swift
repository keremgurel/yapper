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
        StudioSheet(
            title: region == nil ? "Mask an area" : "Edit mask",
            detail: "Move and resize the rectangle over the part to hide. The picture itself is not changed.",
            width: 680,
            confirmTitle: "Save mask",
            isWorking: saving,
            canConfirm: !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            error: error,
            onCancel: { dismiss() },
            onConfirm: { save() },
            extraActions: {
                if region != nil {
                    Button("Remove mask", role: .destructive) { save(removing: true) }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                        .disabled(saving)
                }
            },
            content: {
                CropCanvas(image: session.overlaySourceImage(media), mediaAspect: CompositionBuilder.aspect(of: media),
                           crop: rect, minimumSide: 0.005, onCommit: { rect = $0 })
                    .frame(maxWidth: .infinity, maxHeight: 320)
                HStack(alignment: .bottom, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Name")
                            .font(.studioCaption)
                            .foregroundStyle(Color.studioTextMuted)
                        StudioSheetTextField(placeholder: "What this mask hides", text: $label)
                    }
                    ColorPicker("Cover colour", selection: $color, supportsOpacity: false)
                        .font(.studioLabel)
                        .fixedSize()
                }
                HStack(alignment: .bottom, spacing: 12) {
                    dimension("Left", keyPath: \.x)
                    dimension("Top", keyPath: \.y)
                    dimension("Width", keyPath: \.width)
                    dimension("Height", keyPath: \.height)
                }
                StudioSheetSwitchRow(title: "Fade the mask in or out", isOn: $animated)
                if animated {
                    if region?.opacityKeys == nil && region?.policy == .untilCue && !timingEdited {
                        Text("The saved animation is kept as it is. Changing these keyframes replaces its timing and easing.")
                            .font(.studioCaption)
                            .foregroundStyle(Color.studioTextMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    AnimationAnchorEditor(kind: $anchor, time: $anchorTime, phrase: $phrase, occurrence: $occurrence)
                    Text("Keyframe times are seconds after the starting point. 100% covers the area and 0% shows it.")
                        .font(.studioCaption)
                        .foregroundStyle(Color.studioTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                    ScrollView {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach($keys) { $key in
                                HStack(alignment: .bottom, spacing: 10) {
                                    StudioSheetNumberField(label: "Time", value: $key.time, unit: "s", showsLabel: key.id == keys.first?.id)
                                    StudioSheetNumberField(label: "Cover", value: $key.opacity, decimals: 0, unit: "%", showsLabel: key.id == keys.first?.id)
                                    StudioSheetEasingControl(easing: $key.easing)
                                    Spacer(minLength: 0)
                                    StudioSheetRemoveButton(help: "Remove this keyframe") {
                                        keys.removeAll { $0.id == key.id }
                                    }
                                    .disabled(keys.count <= 2)
                                }
                            }
                        }
                    }
                    .frame(maxHeight: 130)
                    Button {
                        keys.append(.init(time: (keys.last?.time ?? 0) + 1, opacity: keys.last?.opacity ?? 100))
                    } label: {
                        StudioGlyphLabel("Add keyframe", glyph: .plus, size: 12)
                    }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    .disabled(keys.count >= 32)
                }
            }
        )
        .onChange(of: animated) { _, _ in timingEdited = true }
        .onChange(of: keys) { _, _ in timingEdited = true }
        .onChange(of: anchor) { _, _ in timingEdited = true }
        .onChange(of: anchorTime) { _, _ in timingEdited = true }
        .onChange(of: phrase) { _, _ in timingEdited = true }
        .onChange(of: occurrence) { _, _ in timingEdited = true }
    }

    private func dimension(_ name: String, keyPath: WritableKeyPath<OverlayCrop, Double>) -> some View {
        StudioSheetNumberField(
            label: name,
            value: Binding(get: { rect[keyPath: keyPath] * 100 }, set: { rect[keyPath: keyPath] = $0 / 100 }),
            decimals: 1,
            unit: "%",
            width: 56
        )
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
