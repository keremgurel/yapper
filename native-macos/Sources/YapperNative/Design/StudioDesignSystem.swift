import AppKit
import SwiftUI

enum StudioTheme: String, CaseIterable {
    case dark
    case light

    var colorScheme: ColorScheme {
        self == .dark ? .dark : .light
    }

    var next: StudioTheme {
        self == .dark ? .light : .dark
    }
}

extension Font {
    static let studioEyebrow = Font.system(size: 11, weight: .bold, design: .monospaced)
    static let studioTitle = Font.system(size: 34, weight: .black, design: .rounded)
    static let studioSectionTitle = Font.system(size: 15, weight: .bold)
    static let studioBody = Font.system(size: 13)
    static let studioBodyStrong = Font.system(size: 13, weight: .semibold)
    static let studioCaption = Font.system(size: 11)
    static let studioCaptionStrong = Font.system(size: 11, weight: .semibold)
}

extension Color {
    static let editorBackground = adaptive(
        light: NSColor(red: 0.955, green: 0.958, blue: 0.966, alpha: 1),
        dark: NSColor(red: 0.035, green: 0.037, blue: 0.041, alpha: 1)
    )
    static let panelBackground = adaptive(
        light: NSColor(red: 0.985, green: 0.986, blue: 0.991, alpha: 1),
        dark: NSColor(red: 0.055, green: 0.058, blue: 0.064, alpha: 1)
    )
    static let raisedBackground = adaptive(
        light: NSColor(red: 1, green: 1, blue: 1, alpha: 1),
        dark: NSColor(red: 0.075, green: 0.078, blue: 0.086, alpha: 1)
    )
    static let sidebarBackground = adaptive(
        light: NSColor(red: 0.925, green: 0.932, blue: 0.946, alpha: 1),
        dark: NSColor(red: 0.045, green: 0.047, blue: 0.052, alpha: 1)
    )
    static let studioInputBackground = adaptive(
        light: NSColor.black.withAlphaComponent(0.045),
        dark: NSColor.black.withAlphaComponent(0.22)
    )
    static let studioLine = adaptive(
        light: NSColor.black.withAlphaComponent(0.10),
        dark: NSColor.white.withAlphaComponent(0.09)
    )
    static let studioFaintFill = adaptive(
        light: NSColor.black.withAlphaComponent(0.045),
        dark: NSColor.white.withAlphaComponent(0.055)
    )
    static let studioSelectedFill = adaptive(
        light: NSColor.white.withAlphaComponent(0.76),
        dark: NSColor.white.withAlphaComponent(0.08)
    )
    /// The pasteboard around the export canvas. Keep this visibly separate
    /// from the canvas's true black background in both app themes.
    static let previewWorkspaceBackground = adaptive(
        light: NSColor(red: 0.19, green: 0.20, blue: 0.22, alpha: 1),
        dark: NSColor(red: 0.095, green: 0.10, blue: 0.11, alpha: 1)
    )
    static let previewCanvasBorder = adaptive(
        light: NSColor.white.withAlphaComponent(0.30),
        dark: NSColor.white.withAlphaComponent(0.17)
    )
    static let yapperOrange = Color(red: 1, green: 0.48, blue: 0.13)

    private static func adaptive(light: NSColor, dark: NSColor) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            let match = appearance.bestMatch(from: [.darkAqua, .aqua])
            return match == .darkAqua ? dark : light
        })
    }
}

extension View {
    @ViewBuilder
    func studioGlass(
        radius: CGFloat = 10,
        tint: Color? = nil,
        interactive: Bool = false
    ) -> some View {
        if #available(macOS 26.0, *) {
            let material = Glass.regular.tint(tint).interactive(interactive)
            glassEffect(material, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
        } else {
            background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .stroke(Color.studioLine, lineWidth: 1)
                }
        }
    }
}
