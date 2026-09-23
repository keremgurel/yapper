import SwiftUI

/// Framing guides over the camera: a rule-of-thirds grid for your eyes, and
/// the zones where TikTok, Reels and Shorts draw their own buttons and
/// caption. Only a guide; nothing here is recorded.
struct RecorderGuidesOverlay: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack(alignment: .topLeading) {
                Path { path in
                    for fraction in [1.0 / 3, 2.0 / 3] {
                        path.move(to: CGPoint(x: w * fraction, y: 0))
                        path.addLine(to: CGPoint(x: w * fraction, y: h))
                        path.move(to: CGPoint(x: 0, y: h * fraction))
                        path.addLine(to: CGPoint(x: w, y: h * fraction))
                    }
                }
                .stroke(Color.white.opacity(0.22), lineWidth: 1)

                // The like, comment and share column on the right.
                zone.frame(width: w * 0.14, height: h * 0.46)
                    .offset(x: w * 0.83, y: h * 0.42)

                // The caption and handle along the bottom.
                VStack(alignment: .leading, spacing: 4) {
                    Text("Keep clear")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.white.opacity(0.7))
                    zone.frame(width: w * 0.76, height: h * 0.16)
                }
                .offset(x: w * 0.04, y: h * 0.79 - 19)
            }
        }
        .allowsHitTesting(false)
    }

    private var zone: some View {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(Color.white.opacity(0.08))
            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Color.white.opacity(0.35), lineWidth: 1))
    }
}
