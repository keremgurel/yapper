import SwiftUI

/// The branded mark for a publishing platform, the web's `PlatformIcon
/// branded`. Reuses the drawn link marks and adds Facebook's.
struct PublishPlatformGlyph: View {
    let platform: PublishPlatform
    var size: CGFloat = 14

    var body: some View {
        switch platform {
        case .youtube: PlatformGlyph(platform: .youtube, size: size)
        case .instagram: PlatformGlyph(platform: .instagram, size: size)
        case .tiktok: PlatformGlyph(platform: .tiktok, size: size)
        case .facebook: facebook
        }
    }

    private var facebook: some View {
        Circle()
            .fill(Color(red: 0.09, green: 0.47, blue: 0.95))
            .overlay {
                Text("f")
                    .font(.system(size: size * 0.78, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .offset(x: size * 0.03, y: size * 0.06)
            }
            .frame(width: size, height: size)
    }
}
