import SwiftUI

/// What a row shows while its first draft is being written: the step it is
/// probably on, shimmering, moving on every few seconds. The server reports
/// no progress, so the steps follow the usual order and stop at the last one
/// rather than claiming to be done.
struct IdeaDraftingIndicator: View {
    let fromLink: Bool
    @State private var started = Date()

    private var steps: [String] {
        fromLink
            ? ["Watching the video", "Reading the transcript", "Finding the hook", "Piecing the script together"]
            : ["Reading your note", "Finding the hook", "Piecing the script together"]
    }

    var body: some View {
        TimelineView(.periodic(from: started, by: 1)) { timeline in
            let index = min(Int(timeline.date.timeIntervalSince(started) / 3.5), steps.count - 1)
            HStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.yapperOrange)
                Text(steps[index] + "…")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                    .nativeShimmer()
                    .contentTransition(.opacity)
                    .animation(.easeOut(duration: 0.25), value: index)
            }
        }
        .onAppear { started = Date() }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Drafting")
    }
}

/// A grey pill that stands in for a value that is still being worked out.
struct IdeaPendingPill: View {
    var width: CGFloat = 84

    var body: some View {
        Capsule().fill(Color.studioFaintFill)
            .frame(width: width, height: 20)
            .nativeShimmer()
    }
}
