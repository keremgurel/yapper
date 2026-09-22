import SwiftUI

/// The one coloured label. Hue names a value (a status, a format); shape and
/// size stay the same everywhere so chips from different systems read as one.
struct NativeChip: View {
    enum Tone { case neutral, orange, cyan, yellow, green, violet, red, blue
        var color: Color {
            switch self {
            case .neutral: .secondary
            case .orange: .yapperOrange
            case .cyan: Color(red: 0.13, green: 0.65, blue: 0.78)
            case .yellow: Color(red: 0.80, green: 0.62, blue: 0.10)
            case .green: Color(red: 0.24, green: 0.66, blue: 0.40)
            case .violet: Color(red: 0.52, green: 0.42, blue: 0.86)
            case .red: .studioDanger
            case .blue: Color(red: 0.25, green: 0.47, blue: 0.95)
            }
        }
    }

    let text: String
    var tone: Tone = .neutral
    var dot = false

    var body: some View {
        HStack(spacing: 5) {
            if dot { Circle().fill(tone.color).frame(width: 6, height: 6) }
            Text(text).font(.system(size: 11, weight: .semibold)).lineLimit(1)
        }
        .foregroundStyle(dot || tone == .neutral ? Color.primary.opacity(0.78) : tone.color)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(Capsule().fill(dot || tone == .neutral ? Color.studioFaintFill : tone.color.opacity(0.14)))
    }
}
