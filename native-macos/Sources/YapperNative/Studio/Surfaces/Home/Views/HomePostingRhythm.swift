import SwiftUI

/// Twelve weeks of posting as columns of dots, one per post, this week on
/// the right: gaps and streaks read at a glance without a chart.
struct HomePostingRhythm: View {
    /// Posts per rolling week, oldest first.
    let weeks: [Int]
    let thisWeek: Int
    let usual: Int

    private static let maxDots = 5

    var body: some View {
        NativeSection(title: "Posting rhythm", meta: "\(thisWeek) this week, usually \(usual)") {
            VStack(spacing: 8) {
                HStack(alignment: .bottom, spacing: 6) {
                    ForEach(Array(weeks.enumerated()), id: \.offset) { _, count in
                        column(count).frame(maxWidth: .infinity)
                    }
                }
                .frame(height: 76, alignment: .bottom)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Posts per week for the last \(weeks.count) weeks: \(weeks.map(String.init).joined(separator: ", "))")

                HStack {
                    Text("\(weeks.count) weeks ago")
                    Spacer()
                    Text("This week")
                }
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
            }
        }
    }

    private func column(_ count: Int) -> some View {
        VStack(spacing: 4) {
            if count > Self.maxDots {
                Text("+\(count - Self.maxDots)")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
            if count == 0 {
                Circle().fill(Color.studioFaintFill).frame(width: 10, height: 10)
            } else {
                ForEach(0..<min(count, Self.maxDots), id: \.self) { _ in
                    Circle().fill(NativeChip.Tone.green.color).frame(width: 10, height: 10)
                }
            }
        }
    }
}
