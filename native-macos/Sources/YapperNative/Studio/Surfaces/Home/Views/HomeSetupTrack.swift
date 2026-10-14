import SwiftUI

/// Getting started, for a creator who has not finished it: three steps in a
/// row with how many are done. It disappears for good once all three are.
struct HomeSetupTrack: View {
    let steps: [HomeSetupStep]

    private var done: Int { steps.filter(\.done).count }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("Get set up").font(.system(size: 13, weight: .semibold))
                Spacer(minLength: 8)
                Text("\(done) of \(steps.count) done")
                    .font(.system(size: 12).monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)

            progress
                .padding(.horizontal, 16)
                .padding(.top, 10)

            HStack(alignment: .top, spacing: 0) {
                ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                    if index > 0 { Rectangle().fill(Color.studioLine).frame(width: 1) }
                    HomeSetupStepCell(step: step, number: index + 1)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
        }
        .background(NativeCardBackground(radius: 12))
    }

    private var progress: some View {
        GeometryReader { proxy in
            Capsule().fill(Color.studioFaintFill)
                .overlay(alignment: .leading) {
                    Capsule().fill(NativeChip.Tone.green.color)
                        .frame(width: proxy.size.width * CGFloat(done) / CGFloat(max(steps.count, 1)))
                }
        }
        .frame(height: 4)
        .animation(.easeOut(duration: 0.5), value: done)
    }
}

private struct HomeSetupStepCell: View {
    let step: HomeSetupStep
    let number: Int

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            badge
            VStack(alignment: .leading, spacing: 2) {
                Text(step.title)
                    .font(.system(size: 13, weight: .medium))
                    .strikethrough(step.done)
                    .foregroundStyle(step.done ? .secondary : .primary)
                if !step.done {
                    Text(step.detail)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if let action = step.action {
                        Button(action.label) { StudioNavigation.shared.goTo(action.destination) }
                            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                            .padding(.top, 8)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    private var badge: some View {
        ZStack {
            Circle().fill(step.done ? NativeChip.Tone.green.color : Color.studioFaintFill)
            if step.done {
                Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
            } else {
                Text("\(number)").font(.system(size: 12, weight: .semibold).monospacedDigit()).foregroundStyle(.secondary)
            }
        }
        .frame(width: 24, height: 24)
    }
}
