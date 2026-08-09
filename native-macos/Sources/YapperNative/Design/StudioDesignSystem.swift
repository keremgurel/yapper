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

/// The surface ramp, taken value for value from the web design system's
/// semantic tokens in `src/app/globals.css`. The dark side is a cool graphite
/// ramp, deliberately not black: long stretches of text on true black are
/// punishing to read, and the two apps have to look like one product.
extension Color {
    /// `--sg-bg`
    static let editorBackground = adaptive(
        light: NSColor(hex: 0xF4F3F1),
        dark: NSColor(hex: 0x0A0A0B)
    )
    /// `--sg-surface` — the panels that carry text
    static let panelBackground = adaptive(
        light: NSColor(hex: 0xFFFFFF),
        dark: NSColor(hex: 0x171719)
    )
    /// `--sg-surface-raised`
    static let raisedBackground = adaptive(
        light: NSColor(hex: 0xFFFFFF),
        dark: NSColor(hex: 0x202023)
    )
    /// `--sg-bg-2`
    static let sidebarBackground = adaptive(
        light: NSColor(hex: 0xEDEAE6),
        dark: NSColor(hex: 0x101012)
    )
    /// `--sg-surface-sunken` — wells, inputs, segmented tracks
    static let studioInputBackground = adaptive(
        light: NSColor(hex: 0xF0EEEB),
        dark: NSColor(hex: 0x101012)
    )
    /// `--sg-border`
    static let studioLine = adaptive(
        light: NSColor(red: 0.125, green: 0.114, blue: 0.114, alpha: 0.10),
        dark: NSColor.white.withAlphaComponent(0.08)
    )
    /// `--sg-border-strong`
    static let studioLineStrong = adaptive(
        light: NSColor(red: 0.125, green: 0.114, blue: 0.114, alpha: 0.18),
        dark: NSColor.white.withAlphaComponent(0.15)
    )
    /// The selected segment inside a control: lifted off the sunken track it
    /// sits in, rather than coloured. See `InspectorSegmentedControl`.
    static let studioRaisedChip = adaptive(
        light: NSColor.white,
        dark: NSColor(hex: 0x2A2A2E)
    )
    static let studioFaintFill = adaptive(
        light: NSColor.black.withAlphaComponent(0.045),
        dark: NSColor.white.withAlphaComponent(0.055)
    )
    static let studioSelectedFill = adaptive(
        light: NSColor.black.withAlphaComponent(0.05),
        dark: NSColor.white.withAlphaComponent(0.08)
    )
    /// The pasteboard around the export canvas. Keep this visibly separate
    /// from the canvas's true black background in both app themes.
    static let previewWorkspaceBackground = adaptive(
        light: NSColor(hex: 0x2F2F33),
        dark: NSColor(hex: 0x121214)
    )
    static let previewCanvasBorder = adaptive(
        light: NSColor.white.withAlphaComponent(0.30),
        dark: NSColor.white.withAlphaComponent(0.17)
    )
    static let yapperOrange = Color(red: 1, green: 0.48, blue: 0.13)
    /// `--destructive`
    static let studioDanger = Color(red: 0.898, green: 0.282, blue: 0.302)
    /// `--sg-glass-bg`
    static let studioGlassFill = adaptive(
        light: NSColor.white.withAlphaComponent(0.62),
        dark: NSColor.white.withAlphaComponent(0.05)
    )
    /// `--sg-glass-border`
    static let studioGlassBorder = adaptive(
        light: NSColor.white.withAlphaComponent(0.90),
        dark: NSColor.white.withAlphaComponent(0.14)
    )
    /// `--sg-glass-highlight`, the lit top edge of a glass panel
    static let studioGlassHighlight = adaptive(
        light: NSColor.white.withAlphaComponent(0.95),
        dark: NSColor.white.withAlphaComponent(0.60)
    )

    private static func adaptive(light: NSColor, dark: NSColor) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            let match = appearance.bestMatch(from: [.darkAqua, .aqua])
            return match == .darkAqua ? dark : light
        })
    }
}

extension View {
    /// The brand's glass panel, ported from `.sg-glass`: a translucent fill, a
    /// hairline border, and a highlight that fades out of the top edge.
    ///
    /// Deliberately NOT macOS 26's Liquid Glass. That material is Apple's
    /// house style and reads as a system control; Studio's glass is part of
    /// the product's own look and has to match the web app it sits beside.
    func studioGlass(radius: CGFloat = 10, tint: Color? = nil) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return background {
            shape
                .fill(.ultraThinMaterial)
                .overlay { shape.fill(tint ?? Color.studioGlassFill) }
                .overlay {
                    shape.strokeBorder(
                        LinearGradient(
                            stops: [
                                .init(color: .studioGlassHighlight, location: 0),
                                .init(color: .studioGlassBorder, location: 0.4),
                                .init(color: .studioGlassBorder, location: 1),
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        lineWidth: 1
                    )
                }
                .shadow(color: .black.opacity(0.10), radius: 6, y: 2)
        }
        .clipShape(shape)
    }

    /// The same glass, laid behind the content instead of around it.
    ///
    /// Nothing is clipped, so a panel built on this can let a menu or a
    /// suggestion list hang outside its own edges — which is the only way a
    /// list of files can be taller than the box that opened it.
    func studioGlassBackground(radius: CGFloat = 10, tint: Color? = nil) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return background {
            shape
                .fill(.ultraThinMaterial)
                .overlay { shape.fill(tint ?? Color.studioGlassFill) }
                .overlay {
                    shape.strokeBorder(
                        LinearGradient(
                            stops: [
                                .init(color: .studioGlassHighlight, location: 0),
                                .init(color: .studioGlassBorder, location: 0.4),
                                .init(color: .studioGlassBorder, location: 1),
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        lineWidth: 1
                    )
                }
                .shadow(color: .black.opacity(0.10), radius: 6, y: 2)
        }
    }
}

extension View {
    /// Pins an inspector tab's content to the top-left at a readable measure,
    /// so every workbench pane lines up no matter how wide the panel gets.
    func inspectorPane(maxWidth: CGFloat) -> some View {
        HStack(spacing: 0) {
            self.frame(maxWidth: maxWidth, maxHeight: .infinity, alignment: .topLeading)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

extension NSColor {
    /// Reads the design system's tokens in the form they are written in CSS.
    convenience init(hex: UInt32) {
        self.init(
            srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
