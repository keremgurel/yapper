import SwiftUI

/// The bar in an export row. Drawn here rather than with `ProgressView`,
/// which AppKit paints grey whenever its window is not key, so it matches
/// the orange ring in the top bar on every surface.
struct ExportProgressBar: View {
    let fraction: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.studioFaintFill)
                Capsule()
                    .fill(Color.yapperOrange)
                    .frame(width: max(4, proxy.size.width * min(1, max(0, fraction))))
            }
        }
        .frame(height: 4)
        .animation(.linear(duration: 0.25), value: fraction)
        .accessibilityElement()
        .accessibilityValue(ExportJobCopy.percent(fraction))
    }
}
