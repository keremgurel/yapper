import SwiftUI

/// The hours 1-Click Edit has given back, in one card: the time saved against
/// cutting it yourself, the footage it read, then videos edited and cuts
/// made. The web's `time-saved-card.tsx`. Nil keeps the shape while it
/// loads; nothing counted yet says where the number comes from instead of a
/// zero.
struct HomeTimeSavedCard: View {
    let saved: HomeTimeSaved?

    /// Mirrors `SECONDS_PER_MANUAL_CUT` in `src/lib/studio/edit-run.ts`.
    private static let secondsPerManualCut = 20

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Time saved").font(.system(size: 13, weight: .semibold))
                Spacer()
                Image(systemName: "info.circle")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .help(howItsCounted)
                    .accessibilityLabel(howItsCounted)
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)

            if let saved, saved.edits == 0 {
                NativeEmptyState(
                    systemImage: "scissors",
                    title: "Your time saved starts here",
                    message: "Run 1-Click Edit on a take and the hours it saves you add up in this card."
                ) { EmptyView() }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else {
                headline
                Rectangle().fill(Color.studioLine).frame(height: 1)
                HStack(spacing: 0) {
                    cell("Videos edited", saved.map { $0.edits.formatted(.number) }, "With 1-Click Edit")
                    Rectangle().fill(Color.studioLine).frame(width: 1)
                    cell("Cuts made", saved.map { $0.cutCount.formatted(.number) }, "Pauses, retakes and filler")
                }
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .background(NativeCardBackground(radius: 12))
    }

    private var headline: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let saved {
                Text(HomeDuration.text(saved.savedSeconds))
                    .font(.system(size: 34, weight: .bold).monospacedDigit())
                    .contentTransition(.numericText())
            } else {
                RoundedRectangle(cornerRadius: 6).fill(Color.studioFaintFill).frame(width: 190, height: 40)
            }
            Text("saved vs cutting it yourself")
                .font(.system(size: 13))
                .foregroundStyle(.secondary)
            if let saved {
                Text("\(HomeDuration.text(saved.footageSeconds)) of footage · \(HomeDuration.text(saved.cutSeconds)) cut out")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
        .padding(.bottom, 16)
    }

    private func cell(_ label: String, _ value: String?, _ detail: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.nativeLabel).foregroundStyle(.secondary)
            if let value {
                Text(value).font(.system(size: 24, weight: .semibold).monospacedDigit())
            } else {
                RoundedRectangle(cornerRadius: 6).fill(Color.studioFaintFill).frame(width: 64, height: 28)
            }
            Text(detail).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
    }

    private var howItsCounted: String {
        let base = "One watch of your footage plus about \(Self.secondsPerManualCut) seconds for every cut, the time it takes to make them by hand."
        guard let since = saved?.since, let date = IdeaDates.parse(since) else { return base }
        return "\(base) Counted from your 1-Click Edits since \(date.formatted(date: .abbreviated, time: .omitted))."
    }
}
