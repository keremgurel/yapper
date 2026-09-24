import SwiftUI

/// Saturation left to right, brightness bottom to top, for the current hue.
struct BrandSaturationSquare: View {
    @Binding var value: BrandHSB

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            ZStack {
                Color(hue: value.hue, saturation: 1, brightness: 1)
                LinearGradient(colors: [.white, .white.opacity(0)], startPoint: .leading, endPoint: .trailing)
                LinearGradient(colors: [.black.opacity(0), .black], startPoint: .top, endPoint: .bottom)
                Circle()
                    .strokeBorder(.white, lineWidth: 2)
                    .background(Circle().fill(value.color))
                    .shadow(color: .black.opacity(0.35), radius: 2)
                    .frame(width: 16, height: 16)
                    .position(x: value.saturation * size.width, y: (1 - value.brightness) * size.height)
            }
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { drag in
                value.saturation = min(max(drag.location.x / size.width, 0), 1)
                value.brightness = 1 - min(max(drag.location.y / size.height, 0), 1)
            })
        }
        .frame(height: 150)
        .accessibilityLabel("Saturation and brightness")
    }
}
