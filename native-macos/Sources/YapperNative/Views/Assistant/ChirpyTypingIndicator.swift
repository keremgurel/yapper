import SwiftUI

/// Three dots, breathing, while Chirpy works.
///
/// A spinner says the app is busy; this says someone is composing an answer,
/// which is the truer description of a run that ends in a sentence. It sits in
/// the transcript where the reply will appear, so the reply does not arrive
/// somewhere the eye is not already looking.
struct ChirpyTypingIndicator: View {
    /// Driven by the clock rather than by a repeating animation on each dot:
    /// three overlapping `repeatForever` animations in a view that is rebuilt
    /// whenever a message lands is how they end up out of step with each other.
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            ChirpyMascot(expression: .yap, talking: true, size: 22)
                .frame(width: 24, height: 24)

            TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
                let phase = context.date.timeIntervalSinceReferenceDate
                HStack(spacing: 4) {
                    ForEach(0..<3, id: \.self) { index in
                        Circle()
                            .fill(Color.secondary)
                            .frame(width: 5, height: 5)
                            .opacity(opacity(at: phase, index: index))
                            .offset(y: -2 * rise(at: phase, index: index))
                    }
                }
                .frame(height: 24)
            }
            Spacer(minLength: 24)
        }
        .accessibilityLabel("Chirpy is working")
    }

    /// A wave running left to right, one dot every third of a cycle.
    private func rise(at phase: TimeInterval, index: Int) -> Double {
        let cycle = 1.1
        let offset = Double(index) * cycle / 3
        return max(0, sin((phase - offset) / cycle * 2 * .pi))
    }

    private func opacity(at phase: TimeInterval, index: Int) -> Double {
        0.35 + 0.5 * rise(at: phase, index: index)
    }
}
