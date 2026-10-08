import SwiftUI

/// The same palette and fraction as the web, supplied by the billing snapshot.
struct CreditAvatar: View {
    let name: String
    let imageURL: URL?
    let meter: StudioCreditMeter?
    var diameter: CGFloat = 36
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ZStack {
            Circle().strokeBorder(Color.primary.opacity(0.15), lineWidth: diameter * 0.075)
            if let fraction = meter?.clampedFraction {
                Circle()
                    .trim(from: 0, to: max(0.01, fraction))
                    .stroke(creditColor(meter, scheme: colorScheme), style: StrokeStyle(lineWidth: diameter * 0.075, lineCap: .round))
                    .padding(diameter * 0.0375)
                    .rotationEffect(.degrees(-90))
            }
            AsyncImage(url: imageURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Circle().fill(Color.studioFaintFill)
                    .overlay(Text(String(name.prefix(1)).uppercased()).font(.system(size: diameter * 0.3, weight: .semibold)).foregroundStyle(Color.primary))
            }
            .frame(width: diameter * 0.7, height: diameter * 0.7)
            .clipShape(Circle())
        }
        .frame(width: diameter, height: diameter)
        .accessibilityHidden(true)
    }
}

func creditColor(_ meter: StudioCreditMeter?, scheme: ColorScheme) -> Color {
    guard let hex = scheme == .dark ? meter?.darkColor : meter?.lightColor,
          hex.count == 7, hex.hasPrefix("#"),
          let value = UInt32(hex.dropFirst(), radix: 16) else { return .secondary }
    return Color(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
}
