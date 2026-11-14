import SwiftUI

private struct FramingDraftKey: Identifiable {
    let id = UUID()
    var offset: Double
    var scale: Double
    var x: Double = 0
    var y: Double = 0
    var rotation: Double = 0
    var easing: AnimationEase = .smooth
}

struct VideoAnimationSheet: View {
    @ObservedObject var session: EditorSession
    @Environment(\.dismiss) private var dismiss
    @State private var anchor: TimelineAnchorKind = .time
    @State private var time: Double
    @State private var phrase = ""
    @State private var occurrence = 1
    @State private var pivot: AnimationPivot = .frameCenter
    @State private var keys = [FramingDraftKey(offset: 0, scale: 100), FramingDraftKey(offset: 1, scale: 120)]
    @State private var error: String?
    @State private var saving = false

    init(session: EditorSession, playhead: Double) {
        self.session = session; _time = State(initialValue: playhead)
    }

    var body: some View {
        StudioSheet(
            title: "Animate framing",
            detail: "Add keyframes that scale, move and rotate the shot from where it is framed now. You can edit them later on the timeline.",
            width: 760,
            confirmTitle: "Add keyframes",
            isWorking: saving,
            error: error,
            onCancel: { dismiss() },
            onConfirm: save
        ) {
            AnimationAnchorEditor(kind: $anchor, time: $time, phrase: $phrase, occurrence: $occurrence)

            VStack(alignment: .leading, spacing: 6) {
                Text("Zooms around")
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
                InspectorSegmentedControl(
                    options: [
                        .init(value: AnimationPivot.frameCenter, label: "The centre of the frame"),
                        .init(value: AnimationPivot.face, label: "The face in shot"),
                    ],
                    selection: pivot
                ) { pivot = $0 }
                if pivot == .face {
                    Text("Uses the face found at the start of each clip, or the centre of the frame if there is none.")
                        .font(.studioCaption)
                        .foregroundStyle(Color.studioTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Keyframes")
                    .font(.studioLabelStrong)
                Text("Time is seconds after the starting point. Position is a percentage of the frame, and 100% scale keeps the current size.")
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach($keys) { $key in
                            HStack(alignment: .bottom, spacing: 10) {
                                StudioSheetNumberField(label: "Time", value: $key.offset, unit: "s", showsLabel: key.id == keys.first?.id)
                                StudioSheetNumberField(label: "Scale", value: $key.scale, decimals: 0, unit: "%", showsLabel: key.id == keys.first?.id)
                                StudioSheetNumberField(label: "Across", value: $key.x, decimals: 0, unit: "%", showsLabel: key.id == keys.first?.id)
                                StudioSheetNumberField(label: "Down", value: $key.y, decimals: 0, unit: "%", showsLabel: key.id == keys.first?.id)
                                StudioSheetNumberField(label: "Rotate", value: $key.rotation, decimals: 0, unit: "°", showsLabel: key.id == keys.first?.id)
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
                .frame(maxHeight: 240)
                HStack(spacing: 8) {
                    Button {
                        keys.append(.init(offset: (keys.last?.offset ?? 0) + 1, scale: keys.last?.scale ?? 100))
                    } label: {
                        StudioGlyphLabel("Add keyframe", glyph: .plus, size: 12)
                    }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    .disabled(keys.count >= 32)
                    Button("Use a quick zoom in and out") {
                        keys = [.init(offset: 0, scale: 100), .init(offset: 0.16, scale: 120),
                            .init(offset: 0.36, scale: 120), .init(offset: 0.56, scale: 100)]
                        pivot = .face
                    }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                    .help("Replace these keyframes with a half-second punch in on the face")
                }
            }
        }
    }

    private func save() {
        saving = true
        Task {
            let input = FramingAnimationInput(keys: keys.map {
                .init(at: .init(kind: anchor, time: anchor == .time ? time : nil,
                    phrase: anchor == .phrase ? phrase : nil, occurrence: anchor == .phrase ? occurrence : nil,
                    eventID: nil, offset: $0.offset), scaleMultiplier: $0.scale / 100,
                    x: $0.x / 100, y: $0.y / 100, rotation: $0.rotation, easing: $0.easing)
            }, pivot: pivot)
            let result = await session.performAppAction(input)
            saving = false
            if result.status == .applied || result.status == .unchanged { dismiss() }
            else { error = result.message }
        }
    }
}
