import SwiftUI

struct StudioIcon: View {
    let symbol: String
    var selected = false
    var size: CGFloat = 30

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                .fill(selected ? Color.yapperOrange.opacity(0.17) : Color.studioFaintFill)

            Image(systemName: symbol)
                .symbolRenderingMode(.hierarchical)
                .font(.system(size: size * 0.46, weight: .semibold))
                .foregroundStyle(selected ? Color.yapperOrange : Color.primary.opacity(0.72))

            Circle()
                .fill(Color.yapperOrange)
                .frame(width: max(3, size * 0.11), height: max(3, size * 0.11))
                .offset(x: size * 0.29, y: -size * 0.29)
                .opacity(selected ? 1 : 0)
                .scaleEffect(selected ? 1 : 0.4)
        }
        .frame(width: size, height: size)
        .animation(.smooth(duration: 0.18), value: selected)
    }
}

struct YapperMark: View {
    var size: CGFloat = 31

    var body: some View {
        Canvas { context, canvasSize in
            let scale = min(canvasSize.width, canvasSize.height) / 40
            func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x * scale, y: y * scale)
            }
            func circle(_ x: CGFloat, _ y: CGFloat, _ radius: CGFloat) -> Path {
                Path(ellipseIn: CGRect(
                    x: (x - radius) * scale,
                    y: (y - radius) * scale,
                    width: radius * 2 * scale,
                    height: radius * 2 * scale
                ))
            }

            var tuft = Path()
            tuft.move(to: point(17, 7))
            tuft.addQuadCurve(to: point(21, 6), control: point(19, 2))
            context.stroke(
                tuft,
                with: .linearGradient(
                    Gradient(colors: [Color(red: 1, green: 0.42, blue: 0.10), Color(red: 0.98, green: 0.66, blue: 0.15)]),
                    startPoint: point(17, 4),
                    endPoint: point(22, 8)
                ),
                style: StrokeStyle(lineWidth: 3 * scale, lineCap: .round)
            )

            context.fill(
                circle(20, 22, 15),
                with: .linearGradient(
                    Gradient(colors: [Color(red: 1, green: 0.42, blue: 0.10), Color(red: 0.98, green: 0.55, blue: 0.18), Color(red: 0.98, green: 0.66, blue: 0.15)]),
                    startPoint: point(7, 8),
                    endPoint: point(34, 36)
                )
            )
            context.fill(circle(15, 19, 4.4), with: .color(.white))
            context.fill(circle(25, 19, 4.4), with: .color(.white))
            let ink = Color(red: 0.165, green: 0.102, blue: 0.055)
            context.fill(circle(16.2, 19.8, 1.9), with: .color(ink))
            context.fill(circle(23.8, 19.8, 1.9), with: .color(ink))

            var brows = Path()
            brows.move(to: point(11.5, 15))
            brows.addLine(to: point(16.5, 17))
            brows.move(to: point(28.5, 15))
            brows.addLine(to: point(23.5, 17))
            context.stroke(
                brows,
                with: .color(ink),
                style: StrokeStyle(lineWidth: 1.6 * scale, lineCap: .round)
            )

            var beak = Path()
            beak.move(to: point(17, 24))
            beak.addLine(to: point(23, 24))
            beak.addLine(to: point(20, 28))
            beak.closeSubpath()
            context.fill(beak, with: .color(Color(red: 0.97, green: 0.70, blue: 0.17)))
        }
        .frame(width: size, height: size)
        .shadow(color: Color.yapperOrange.opacity(0.18), radius: 9, y: 3)
        .accessibilityLabel("Yapper")
    }
}
