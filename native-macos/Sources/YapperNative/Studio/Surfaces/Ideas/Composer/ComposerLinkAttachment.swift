import AppKit
import SwiftUI

/// A platform link shown inline as its mark and name ("Instagram") instead
/// of the raw URL. It is one character in the text view, so Backspace takes
/// the whole link, and it carries the URL so the draft keeps the real text.
final class ComposerLinkAttachment: NSTextAttachment {
    let url: String

    @MainActor
    init(url: String, platform: LinkPlatform, fontSize: CGFloat, dark: Bool) {
        self.url = url
        super.init(data: nil, ofType: nil)
        let renderer = ImageRenderer(content: ComposerLinkChipLabel(platform: platform, fontSize: fontSize)
            .environment(\.colorScheme, dark ? .dark : .light))
        renderer.scale = NSScreen.main?.backingScaleFactor ?? 2
        if let image = renderer.nsImage {
            self.image = image
            // Sit on the baseline like the words around it.
            let descender = NSFont.systemFont(ofSize: fontSize).descender
            bounds = CGRect(x: 0, y: descender, width: image.size.width, height: image.size.height)
        }
    }

    required init?(coder: NSCoder) { fatalError("not used") }
}

/// What the attachment draws: the platform mark and its name in link color.
private struct ComposerLinkChipLabel: View {
    let platform: LinkPlatform
    let fontSize: CGFloat

    var body: some View {
        HStack(spacing: fontSize * 0.3) {
            PlatformGlyph(platform: platform, size: fontSize * 1.05)
            Text(platform.name)
                .font(.system(size: fontSize, weight: .medium))
                .foregroundStyle(Color(nsColor: .linkColor))
        }
        .padding(.horizontal, 1)
        .frame(height: fontSize * 1.3)
    }
}
