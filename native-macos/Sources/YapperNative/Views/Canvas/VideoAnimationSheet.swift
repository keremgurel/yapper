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
        VStack(alignment: .leading, spacing: 14) {
            Text("Animate framing").font(.title2.bold())
            Text("Add scale, position and rotation keyframes relative to the current framing. Edit them later on the timeline.")
                .foregroundStyle(.secondary)
            AnimationAnchorEditor(kind: $anchor, time: $time, phrase: $phrase, occurrence: $occurrence)
            Picker("Pivot", selection: $pivot) {
                Text("Frame center").tag(AnimationPivot.frameCenter)
                Text("Detected face").tag(AnimationPivot.face)
            }
            Text("Offsets are seconds after the timing cue. Position is a percentage of the frame; 100% scale keeps the current size.")
                .font(.caption).foregroundStyle(.secondary)
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach($keys) { $key in
                        HStack {
                            field("Time +", value: $key.offset)
                            field("Scale %", value: $key.scale)
                            field("X %", value: $key.x)
                            field("Y %", value: $key.y)
                            field("Rotate °", value: $key.rotation)
                            Picker("Easing", selection: $key.easing) {
                                Text("Linear").tag(AnimationEase.linear)
                                Text("Smooth").tag(AnimationEase.smooth)
                            }.labelsHidden().frame(width: 85)
                            Button { keys.removeAll { $0.id == key.id } } label: { Image(systemName: "minus.circle") }
                                .disabled(keys.count <= 2).help("Remove keyframe")
                        }
                    }
                }
            }.frame(maxHeight: 240)
            HStack {
                Button("Add keyframe") { keys.append(.init(offset: (keys.last?.offset ?? 0) + 1, scale: keys.last?.scale ?? 100)) }
                    .disabled(keys.count >= 32)
                Button("Preset: quick zoom in and out") {
                    keys = [.init(offset: 0, scale: 100), .init(offset: 0.16, scale: 120),
                        .init(offset: 0.36, scale: 120), .init(offset: 0.56, scale: 100)]
                    pivot = .face
                }
            }
            if pivot == .face { Text("Uses a face detected at the start of each affected clip, or the frame center if none is found.").font(.caption).foregroundStyle(.secondary) }
            if let error { Text(error).foregroundStyle(.red).font(.caption) }
            HStack {
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
                Spacer()
                Button(saving ? "Saving…" : "Add keyframes") { save() }.keyboardShortcut(.defaultAction).disabled(saving)
            }
        }.padding(24).frame(width: 760).interactiveDismissDisabled(saving)
    }

    private func field(_ label: String, value: Binding<Double>) -> some View {
        VStack(alignment: .leading) {
            Text(label).font(.caption)
            TextField(label, value: value, format: .number.precision(.fractionLength(2))).frame(width: 70)
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
