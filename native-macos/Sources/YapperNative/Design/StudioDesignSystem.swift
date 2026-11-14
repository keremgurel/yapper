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

/// The type ramp, matching the web's: regular text, semibold titles and
/// emphasis, nothing lighter than regular. The system face is San Francisco,
/// the same face the website asks an Apple device for.
extension Font {
    static let studioEyebrow = Font.system(size: 12, weight: .regular)
    static let studioTitle = Font.system(size: 28, weight: .semibold)
    static let studioSectionTitle = Font.system(size: 15, weight: .semibold)
    static let studioBody = Font.system(size: 13)
    static let studioBodyStrong = Font.system(size: 13, weight: .semibold)
    static let studioCaption = Font.system(size: 11)
    static let studioCaptionStrong = Font.system(size: 11, weight: .semibold)
    /// 12pt, the step between a caption and body text: control labels and
    /// field values in the editor's panels.
    static let studioLabel = Font.system(size: 12)
    static let studioLabelStrong = Font.system(size: 12, weight: .semibold)
    /// 10pt, the floor. Names drawn on a timeline cell and badges only.
    static let studioMicro = Font.system(size: 10, weight: .medium)
    /// Times and other figures that have to hold their width as they change.
    static let studioTimecode = Font.system(size: 11, weight: .medium, design: .monospaced)
    static let studioTimecodeMicro = Font.system(size: 10, weight: .medium, design: .monospaced)
}

/// The corner steps. Buttons, chips and segmented controls are pills and do
/// not use these; everything with a corner picks one of the four.
enum StudioRadius {
    /// A name tag or badge sitting inside a `control`-radius cell.
    static let tag: CGFloat = 4
    /// Timeline cells, badges and icon buttons.
    static let control: CGFloat = 6
    /// Fields, wells and menu rows.
    static let field: CGFloat = 8
    /// Panels inside a pane, popovers.
    static let panel: CGFloat = 12
    /// Cards and media.
    static let card: CGFloat = 16
}

/// The surface ramp, taken value for value from the web design system's
/// semantic tokens in `src/app/globals.css`, so the two apps look like one
/// product. Light is a warm eggshell with white objects and stone wells, dark
/// sits on true black with warm graphite panels; when the web's tokens change,
/// these change with them.
extension Color {
    /// `--sg-bg`
    static let editorBackground = adaptive(
        light: NSColor(hex: 0xFDFCFC),
        dark: NSColor(hex: 0x000000)
    )
    /// `--sg-surface` — the panels that carry text
    static let panelBackground = adaptive(
        light: NSColor(hex: 0xFFFFFF),
        dark: NSColor(hex: 0x171614)
    )
    /// `--sg-surface-raised`
    static let raisedBackground = adaptive(
        light: NSColor(hex: 0xFFFFFF),
        dark: NSColor(hex: 0x21201D)
    )
    /// `--sidebar`: the page's own eggshell, so chrome and content are one
    /// sheet divided by a hairline.
    static let sidebarBackground = adaptive(
        light: NSColor(hex: 0xFDFCFC),
        dark: NSColor(hex: 0x0C0B0A)
    )
    /// `--sg-surface-sunken` — wells, inputs, segmented tracks
    static let studioInputBackground = adaptive(
        light: NSColor(hex: 0xF5F3F1),
        dark: NSColor(hex: 0x12110F)
    )
    /// `--sg-border`
    static let studioLine = adaptive(
        light: NSColor.black.withAlphaComponent(0.08),
        dark: NSColor.white.withAlphaComponent(0.09)
    )
    /// `--sg-border-strong`
    static let studioLineStrong = adaptive(
        light: NSColor.black.withAlphaComponent(0.14),
        dark: NSColor.white.withAlphaComponent(0.16)
    )
    /// The selected segment inside a control: lifted off the sunken track it
    /// sits in, rather than coloured. See `InspectorSegmentedControl`.
    static let studioRaisedChip = adaptive(
        light: NSColor.white,
        dark: NSColor(hex: 0x2A2826)
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
    /// `--sg-accent`: the action colour. Ink on light, white on dark. Primary
    /// buttons and the current navigation row use it.
    static let studioAccent = adaptive(
        light: NSColor(hex: 0x000000),
        dark: NSColor(hex: 0xFFFFFF)
    )
    /// `--sg-accent-fg`
    static let studioAccentForeground = adaptive(
        light: NSColor(hex: 0xFFFFFF),
        dark: NSColor(hex: 0x000000)
    )
    /// `--sg-text-muted`
    static let studioTextMuted = adaptive(
        light: NSColor(hex: 0x777169),
        dark: NSColor(hex: 0xA59F97)
    )
    /// `--sg-surface-tray`: the stone tray under a segmented control.
    static let studioTray = adaptive(
        light: NSColor(hex: 0xEBE8E4),
        dark: NSColor(hex: 0x0C0B0A)
    )
    /// The brand mark's orange. In the editor it is also the working colour
    /// for things drawn over video (playhead, selection and framing boxes),
    /// where ink or white would vanish into the picture. It is not the action
    /// colour: buttons and navigation use `studioAccent`.
    static let yapperOrange = Color(red: 1, green: 0.48, blue: 0.13)
    /// The brackets around the face the retouch is reading. Deliberately not
    /// `yapperOrange`: the framing box is orange and sits a few points away, and
    /// two orange rectangles around the same head is one rectangle too many.
    /// Cyan also survives being drawn on skin, which is the only place this is
    /// ever drawn.
    static let faceIndicator = Color(red: 0.20, green: 0.87, blue: 0.90)
    /// The "on" and "done" status hue. A state, never an action.
    static let studioSuccess = adaptive(
        light: NSColor(hex: 0x2F9E5B),
        dark: NSColor(hex: 0x4CC27D)
    )
    /// `--destructive`
    static let studioDanger = Color(red: 0.898, green: 0.282, blue: 0.302)
    /// `--sg-glass-bg`
    static let studioGlassFill = adaptive(
        light: NSColor.white.withAlphaComponent(0.66),
        dark: NSColor(hex: 0x21201D).withAlphaComponent(0.72)
    )
    /// `--sg-glass-border`
    static let studioGlassBorder = adaptive(
        light: NSColor.black.withAlphaComponent(0.06),
        dark: NSColor.white.withAlphaComponent(0.10)
    )
    /// `--sg-glass-highlight`, the lit top edge of a glass panel
    static let studioGlassHighlight = adaptive(
        light: NSColor.white.withAlphaComponent(0.95),
        dark: NSColor.white.withAlphaComponent(0.40)
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
