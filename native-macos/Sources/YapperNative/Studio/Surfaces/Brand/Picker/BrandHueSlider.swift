import SwiftUI

/// The hue bar under the square.
struct BrandHueSlider: View {
    @Binding var hue: Double

    private static let spectrum = stride(from: 0.0, through: 1.0, by: 1.0 / 6).map {
        Color(hue: $0, saturation: 1, brightness: 1)
    }

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            ZStack(alignment: .leading) {
                Capsule().fill(LinearGradient(colors: Self.spectrum, startPoint: .leading, endPoint: .trailing))
                Circle()
                    .strokeBorder(.white, lineWidth: 2)
                    .background(Circle().fill(Color(hue: hue, saturation: 1, brightness: 1)))
                    .shadow(color: .black.opacity(0.35), radius: 2)
                    .frame(width: 16, height: 16)
                    .offset(x: hue * (width - 16))
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { drag in
                hue = min(max((drag.location.x - 8) / (width - 16), 0), 1)
            })
        }
        .frame(height: 16)
        .accessibilityLabel("Hue")
    }
}
