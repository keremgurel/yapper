import AppKit
import SwiftUI

/// The editor's own glyphs: the workbench tabs, the timeline's actions and the
/// track rail. One family with the navigation rail (`StudioNavGlyph`): a
/// 20-point grid, a rounded 1.6-point stroke and soft geometric forms.
///
/// Add a glyph by drawing it on the same grid in `StudioGlyphShape`, not by
/// reaching for a stock symbol.
enum StudioGlyphKind: Hashable {
    // Workbench tabs
    case media, quickEdit, transcript, video, audio, text, overlays, captions, filters
    // Timeline actions
    case snap, split, trimStart, trimEnd, delete, autoTrim, zoomOut, zoomIn
    // Track rail
    case eye, eyeOff, speakerMuted, speakerLow, speakerMid, speakerHigh, more
    // Pane chrome
    case close, splitPane
    // Editor bars
    case projects, chevronRight, chevronDown, layoutStandard, layoutTallPreview
    case note, plus, minus, export, play, pause, fullScreen, exitFullScreen, aspect
    // Marks
    case check, stop
}

/// Drawn in the current foreground style, so a control colours its glyph and
/// its label together.
struct StudioGlyph: View {
    let kind: StudioGlyphKind
    var size: CGFloat = 16

    init(_ kind: StudioGlyphKind, size: CGFloat = 16) {
        self.kind = kind
        self.size = size
    }

    var body: some View {
        StudioGlyphShape(kind: kind)
            .stroke(style: StrokeStyle(
                // Held a little heavier than a straight scale at small sizes,
                // where a 1.2-point line starts to look thin beside 12pt text.
                lineWidth: max(1.35, 1.6 * size / 20),
                lineCap: .round,
                lineJoin: .round
            ))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

extension StudioGlyph {
    /// The glyph as a template image, for the places AppKit draws the label
    /// itself. A `Menu` keeps only the text and images in its label, so a
    /// stroked shape handed to one simply does not appear.
    static func image(_ kind: StudioGlyphKind, size: CGFloat = 16) -> Image {
        let image = NSImage(size: NSSize(width: size, height: size), flipped: true) { rect in
            guard let context = NSGraphicsContext.current?.cgContext else { return false }
            context.addPath(StudioGlyphShape(kind: kind).path(in: rect).cgPath)
            context.setLineWidth(max(1.35, 1.6 * size / 20))
            context.setLineCap(.round)
            context.setLineJoin(.round)
            context.setStrokeColor(NSColor.black.cgColor)
            context.strokePath()
            return true
        }
        image.isTemplate = true
        return Image(nsImage: image)
    }
}
