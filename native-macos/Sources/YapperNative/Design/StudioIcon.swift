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
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.26, style: .continuous)
                .fill(Color.yapperOrange.gradient)

            Canvas { context, canvasSize in
                let midY = canvasSize.height * 0.5
                let barWidth = canvasSize.width * 0.075
                let gap = canvasSize.width * 0.095
                let heights: [CGFloat] = [0.24, 0.46, 0.72, 0.5, 0.3]
                let total = CGFloat(heights.count - 1) * gap
                for (index, height) in heights.enumerated() {
                    let x = canvasSize.width * 0.5 - total * 0.5 + CGFloat(index) * gap
                    let rect = CGRect(
                        x: x - barWidth * 0.5,
                        y: midY - canvasSize.height * height * 0.34,
                        width: barWidth,
                        height: canvasSize.height * height * 0.68
                    )
                    context.fill(
                        Path(roundedRect: rect, cornerRadius: barWidth * 0.5),
                        with: .color(.black.opacity(0.82))
                    )
                }
            }
            .padding(size * 0.15)
        }
        .frame(width: size, height: size)
        .shadow(color: Color.yapperOrange.opacity(0.18), radius: 9, y: 3)
    }
}

