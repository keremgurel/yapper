import SwiftUI

/// A small, recognizable mark for a link's platform, drawn rather than
/// shipped as an image so it stays sharp at any size and needs no assets.
struct PlatformGlyph: View {
    let platform: LinkPlatform
    var size: CGFloat = 16

    var body: some View {
        switch platform {
        case .youtube: youtube
        case .instagram: instagram
        case .tiktok: tiktok
        }
    }

    private var youtube: some View {
        RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
            .fill(Color(red: 1, green: 0, blue: 0))
            .frame(width: size, height: size * 0.72)
            .overlay {
                Triangle().fill(.white)
                    .frame(width: size * 0.3, height: size * 0.34)
                    .offset(x: size * 0.03)
            }
            .frame(width: size, height: size)
    }

    private var instagram: some View {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            .fill(LinearGradient(
                colors: [
                    Color(red: 0.99, green: 0.80, blue: 0.29),
                    Color(red: 0.96, green: 0.27, blue: 0.35),
                    Color(red: 0.51, green: 0.23, blue: 0.87),
                ],
                startPoint: .bottomLeading,
                endPoint: .topTrailing
            ))
            .overlay {
                RoundedRectangle(cornerRadius: size * 0.2, style: .continuous)
                    .strokeBorder(.white, lineWidth: size * 0.08)
                    .padding(size * 0.17)
            }
            .overlay {
                Circle().strokeBorder(.white, lineWidth: size * 0.08).frame(width: size * 0.34, height: size * 0.34)
            }
            .overlay(alignment: .topTrailing) {
                Circle().fill(.white).frame(width: size * 0.09, height: size * 0.09)
                    .padding(size * 0.25)
            }
            .frame(width: size, height: size)
    }

    /// The note with TikTok's cyan and red offsets, on its black tile.
    private var tiktok: some View {
        let note = Image(systemName: "music.note").font(.system(size: size * 0.62, weight: .black))
        return RoundedRectangle(cornerRadius: size * 0.26, style: .continuous)
            .fill(Color(red: 0.02, green: 0.02, blue: 0.04))
            .overlay {
                ZStack {
                    note.foregroundStyle(Color(red: 0.15, green: 0.96, blue: 0.94)).offset(x: -size * 0.04, y: -size * 0.03)
                    note.foregroundStyle(Color(red: 1, green: 0.17, blue: 0.33)).offset(x: size * 0.04, y: size * 0.03)
                    note.foregroundStyle(.white)
                }
            }
            .frame(width: size, height: size)
    }
}

private struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.closeSubpath()
        }
    }
}
