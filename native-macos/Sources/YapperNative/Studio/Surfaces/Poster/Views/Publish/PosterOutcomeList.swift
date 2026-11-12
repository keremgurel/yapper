import SwiftUI

/// What happened, per video and destination. Failures stay beside successes.
struct PosterOutcomeList: View {
    let outcomes: [PosterOutcome]

    var body: some View {
        if !outcomes.isEmpty {
            VStack(spacing: 0) {
                ForEach(Array(outcomes.enumerated()), id: \.element.id) { index, outcome in
                    if index > 0 { Rectangle().fill(Color.studioLine).frame(height: 1) }
                    row(outcome)
                }
            }
            .background(NativeCardBackground(radius: 10))
        }
    }

    private func row(_ outcome: PosterOutcome) -> some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(outcome.videoTitle).font(.studioBodyStrong).lineLimit(1)
                Text(outcome.platform.label).font(.studioLabel).foregroundStyle(.secondary)
                if let error = outcome.error {
                    Text(PosterErrorCopy.publish(error)).font(.studioLabel).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if outcome.coverApplied == false {
                    Text("YouTube didn’t apply the cover. You can add it in YouTube Studio.")
                        .font(.studioLabel).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if outcome.status == .draft {
                    Text("Open TikTok, go to your inbox and tap \"Your content from Yapper is ready\" to finish posting.")
                        .font(.studioLabel).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer()
            if let url = outcome.url {
                Link(destination: url) { Label("Posted", systemImage: "arrow.up.right") }
                    .font(.studioLabelStrong)
                    .clickableCursor()
            } else {
                Text(outcome.label).font(.studioLabelStrong)
                    .foregroundStyle(outcome.status == .failed ? Color.studioDanger
                                     : outcome.status == .pending ? Color.secondary : NativeChip.Tone.green.color)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
    }
}
