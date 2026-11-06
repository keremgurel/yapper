import SwiftUI

/// The small mark at the front of the export badge.
struct ExportProgressRing: View {
    let tone: ExportJobsSummary.Tone
    let fraction: Double
    var size: CGFloat = 14

    var body: some View {
        Group {
            switch tone {
            case .running where fraction <= 0:
                ProgressView().controlSize(.mini)
            case .running:
                ZStack {
                    Circle().stroke(Color.studioLineStrong, lineWidth: 2)
                    Circle()
                        .trim(from: 0, to: fraction)
                        .stroke(Color.yapperOrange, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                .padding(1)
                .animation(.linear(duration: 0.25), value: fraction)
            case .done:
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: size - 1, weight: .semibold))
                    .foregroundStyle(Color.yapperOrange)
            case .failed:
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: size - 2, weight: .semibold))
                    .foregroundStyle(Color.studioDanger)
            }
        }
        .frame(width: size, height: size)
    }
}
