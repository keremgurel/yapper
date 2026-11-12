import SwiftUI

/// Shared manual authoring of the same timing anchors available to Chirpy:
/// what a set of keyframes counts its time from.
struct AnimationAnchorEditor: View {
    @Binding var kind: TimelineAnchorKind
    @Binding var time: Double
    @Binding var phrase: String
    @Binding var occurrence: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Starts from")
                .font(.studioCaption)
                .foregroundStyle(Color.studioTextMuted)
            InspectorSegmentedControl(
                options: [
                    .init(value: TimelineAnchorKind.time, label: "A time on the timeline"),
                    .init(value: TimelineAnchorKind.speechStart, label: "When speech starts"),
                    .init(value: TimelineAnchorKind.phrase, label: "A spoken phrase"),
                ],
                selection: kind
            ) { kind = $0 }
            if kind == .time {
                StudioSheetNumberField(label: "Timeline time", value: $time, unit: "seconds", width: 76)
            }
            if kind == .phrase {
                HStack(spacing: 10) {
                    StudioSheetTextField(placeholder: "The exact words, as they are spoken", text: $phrase)
                    Stepper("Time it is said: \(occurrence)", value: $occurrence, in: 1...1000)
                        .font(.studioLabel)
                        .fixedSize()
                }
            }
        }
    }
}
