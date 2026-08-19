import SwiftUI

/// The bar under the step a one-click edit is currently on.
///
/// A spinner alone reads the same whether the step has three seconds left or
/// three minutes, which is what makes a working edit feel hung. This fills at
/// the rate the step usually takes and counts the seconds it has actually been
/// running, so a slow take looks slow rather than broken.
struct StageProgressBar: View {
    let stage: OneClickEditStage
    let pace: OneClickEditPace

    @State private var elapsed: Double = 0

    private var fraction: Double { pace.fraction(for: stage, elapsed: elapsed) }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.secondary.opacity(0.16))
                    Capsule()
                        .fill(Color.yapperOrange)
                        .frame(width: max(2, geometry.size.width * fraction))
                }
            }
            .frame(height: 3)
            // Only past the point where a creator starts to wonder.
            if elapsed >= 4 {
                Text(Self.clock(elapsed))
                    .font(.studioCaption)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
        .animation(.easeOut(duration: 0.45), value: fraction)
        .task(id: stage) {
            elapsed = 0
            let began = Date()
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(250))
                if Task.isCancelled { return }
                elapsed = Date().timeIntervalSince(began)
            }
        }
    }

    static func clock(_ seconds: Double) -> String {
        let whole = Int(seconds.rounded())
        guard whole >= 60 else { return "\(whole)s" }
        return "\(whole / 60)m \(whole % 60)s"
    }
}
