import SwiftUI

/// The account avatar, with the sheen the web's `.account-shimmer` gives it.
///
/// A band of light sweeps diagonally across the picture on hover, clipped to
/// the circle. The sweep fires from anywhere on the trigger, not just the 28pt
/// picture, so it never feels like a target you have to hit.
struct AccountShimmerAvatar: View {
    let initials: String
    var diameter: CGFloat = 26
    /// Driven by the whole trigger's hover state.
    let isSweeping: Bool

    @State private var sweep: CGFloat = -1.2

    var body: some View {
        Circle()
            .fill(
                LinearGradient(
                    colors: [Color.yapperOrange, Color(red: 0.85, green: 0.22, blue: 0.16)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay {
                Text(initials)
                    .font(.system(size: diameter * 0.46, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
            }
            .overlay {
                // 110deg in CSS: a steep diagonal band, transparent either side.
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0.35),
                        .init(color: .white.opacity(0.4), location: 0.5),
                        .init(color: .clear, location: 0.65),
                    ],
                    startPoint: UnitPoint(x: 0, y: 1),
                    endPoint: UnitPoint(x: 1, y: 0)
                )
                .offset(x: sweep * diameter * 2)
                .opacity(sweep < 1.2 ? 0.75 : 0)
            }
            .clipShape(Circle())
            .overlay {
                Circle().strokeBorder(Color.white.opacity(0.18), lineWidth: 1)
            }
            .frame(width: diameter, height: diameter)
            .onChange(of: isSweeping) { _, sweeping in
                guard sweeping else { return }
                sweep = -1.2
                withAnimation(.easeOut(duration: 0.9)) { sweep = 1.3 }
            }
    }
}
