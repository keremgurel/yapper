import SwiftUI

/// Shared manual authoring of the same timing anchors available to Chirpy.
struct AnimationAnchorEditor: View {
    @Binding var kind: TimelineAnchorKind
    @Binding var time: Double
    @Binding var phrase: String
    @Binding var occurrence: Int

    var body: some View {
        HStack {
            Picker("Timing", selection: $kind) {
                Text("Timeline time").tag(TimelineAnchorKind.time)
                Text("Speech starts").tag(TimelineAnchorKind.speechStart)
                Text("Spoken phrase").tag(TimelineAnchorKind.phrase)
            }.frame(width: 220)
            if kind == .time {
                TextField("Seconds", value: $time, format: .number.precision(.fractionLength(2))).frame(width: 70)
                Text("s").foregroundStyle(.secondary)
            }
            if kind == .phrase {
                TextField("Exact spoken phrase", text: $phrase)
                Stepper("Occurrence \(occurrence)", value: $occurrence, in: 1...1000)
            }
        }
    }
}
