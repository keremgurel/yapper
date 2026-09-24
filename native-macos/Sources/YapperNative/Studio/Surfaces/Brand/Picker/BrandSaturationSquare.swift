import SwiftUI

/// Saturation left to right, brightness bottom to top, for the current hue.
struct BrandSaturationSquare: View {
    @Binding var value: BrandHSB

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            // The thumb's centre stays `inset` away from each edge so the
            // whole ring is visible at full saturation or black.
            let inset: CGFloat = 8
            ZStack {
                ZStack {
                    Color(hue: value.hue, saturation: 1, brightness: 1)
                    LinearGradient(colors: [.white, .white.opacity(0)], startPoint: .leading, endPoint: .trailing)
                    LinearGradient(colors: [.black.opacity(0), .black], startPoint: .top, endPoint: .bottom)
                }
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                Circle()
                    .strokeBorder(.white, lineWidth: 2)
                    .background(Circle().fill(value.color))
                    .shadow(color: .black.opacity(0.35), radius: 2)
                    .frame(width: 16, height: 16)
                    .position(
                        x: inset + value.saturation * (size.width - inset * 2),
                        y: inset + (1 - value.brightness) * (size.height - inset * 2)
                    )
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { drag in
                value.saturation = min(max((drag.location.x - inset) / (size.width - inset * 2), 0), 1)
                value.brightness = 1 - min(max((drag.location.y - inset) / (size.height - inset * 2), 0), 1)
            })
        }
        .frame(height: 150)
        .accessibilityLabel("Saturation and brightness")
    }
}
