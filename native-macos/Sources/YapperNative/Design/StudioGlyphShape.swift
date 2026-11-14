import SwiftUI

/// The drawings behind `StudioGlyph`, in grid units on a 20-point square.
struct StudioGlyphShape: Shape {
    let kind: StudioGlyphKind

    func path(in rect: CGRect) -> Path {
        var pen = GlyphPen()
        draw(&pen)
        let scale = min(rect.width, rect.height) / 20
        return pen.path.applying(CGAffineTransform(scaleX: scale, y: scale))
    }

    private func draw(_ p: inout GlyphPen) {
        switch kind {
        case .media:
            // A clip with a second one behind it.
            p.line(6.4, 3.4, 13.6, 3.4)
            p.rounded(3.5, 6, 13, 10.6, 2.4)
            p.polyline([(8.7, 9.1), (12.3, 11.3), (8.7, 13.5)], closed: true)
        case .quickEdit:
            // A wand and the two sparks it throws.
            p.line(4, 16, 11.4, 8.6)
            p.line(14.6, 3, 14.6, 8)
            p.line(12.1, 5.5, 17.1, 5.5)
            p.line(5.6, 4.4, 5.6, 7.2)
            p.line(4.2, 5.8, 7, 5.8)
        case .transcript:
            p.rounded(4.2, 3, 11.6, 14, 2.2)
            p.line(7.2, 7.2, 12.8, 7.2)
            p.line(7.2, 10, 12.8, 10)
            p.line(7.2, 12.8, 10.4, 12.8)
        case .video:
            // The speaker in their frame.
            p.rounded(3.5, 3.5, 13, 13, 2.6)
            p.circle(10, 8.3, 1.9)
            p.arc(from: (6.3, 16.5), to: (13.7, 16.5), control: (10, 9.4))
        case .audio:
            p.line(4, 8.6, 4, 11.4)
            p.line(7, 6, 7, 14)
            p.line(10, 3.6, 10, 16.4)
            p.line(13, 6.6, 13, 13.4)
            p.line(16, 8.6, 16, 11.4)
        case .text:
            p.polyline([(5, 6.6), (5, 4.8), (15, 4.8), (15, 6.6)])
            p.line(10, 4.8, 10, 15.4)
            p.line(8, 15.4, 12, 15.4)
        case .overlays:
            p.rounded(3.2, 3.2, 9.6, 9.6, 2.2)
            p.rounded(7.2, 7.2, 9.6, 9.6, 2.2)
        case .captions:
            p.rounded(3, 4.6, 14, 10.8, 2.6)
            p.line(6, 9, 8.8, 9)
            p.line(11.2, 9, 14, 9)
            p.line(6, 12, 11.6, 12)
        case .filters:
            p.line(3.5, 6, 6.1, 6)
            p.circle(8, 6, 1.9)
            p.line(9.9, 6, 16.5, 6)
            p.line(3.5, 14, 10.1, 14)
            p.circle(12, 14, 1.9)
            p.line(13.9, 14, 16.5, 14)

        case .snap:
            // Two edges meeting on a line.
            p.line(10, 3.5, 10, 16.5)
            p.line(2.8, 10, 7.2, 10)
            p.polyline([(5.2, 8), (7.2, 10), (5.2, 12)])
            p.line(17.2, 10, 12.8, 10)
            p.polyline([(14.8, 8), (12.8, 10), (14.8, 12)])
        case .split:
            p.circle(5.6, 6, 2.1)
            p.circle(5.6, 14, 2.1)
            p.line(7.4, 7.2, 16.5, 13.5)
            p.line(7.4, 12.8, 10.6, 10.6)
            p.line(13.4, 8.6, 16.5, 6.5)
        case .trimStart:
            // The left edge pulled up to the playhead.
            p.line(15.6, 4, 15.6, 16)
            p.line(3.6, 10, 12, 10)
            p.polyline([(9.2, 7.2), (12, 10), (9.2, 12.8)])
        case .trimEnd:
            p.line(4.4, 4, 4.4, 16)
            p.line(16.4, 10, 8, 10)
            p.polyline([(10.8, 7.2), (8, 10), (10.8, 12.8)])
        case .delete:
            p.line(4, 5.8, 16, 5.8)
            p.polyline([(8, 5.6), (8.5, 3.6), (11.5, 3.6), (12, 5.6)])
            p.polyline([(5.5, 5.8), (6.2, 15), (7.8, 16.5), (12.2, 16.5), (13.8, 15), (14.5, 5.8)])
            p.line(8.7, 9, 8.7, 13.2)
            p.line(11.3, 9, 11.3, 13.2)
        case .autoTrim:
            // Sound either side of a silence.
            p.line(3.6, 7.4, 3.6, 12.6)
            p.line(6.6, 4.6, 6.6, 15.4)
            p.line(9.2, 10, 10.8, 10)
            p.line(13.4, 4.6, 13.4, 15.4)
            p.line(16.4, 7.4, 16.4, 12.6)
        case .zoomOut, .zoomIn:
            p.circle(8.8, 8.8, 5.2)
            p.line(12.7, 12.7, 16.6, 16.6)
            p.line(6.6, 8.8, 11, 8.8)
            if kind == .zoomIn { p.line(8.8, 6.6, 8.8, 11) }

        case .eye, .eyeOff:
            p.arc(from: (2.8, 10), to: (17.2, 10), control: (10, 2.6))
            p.arc(from: (2.8, 10), to: (17.2, 10), control: (10, 17.4))
            p.circle(10, 10, 2.1)
            if kind == .eyeOff { p.line(4.2, 15.8, 15.8, 4.2) }
        case .speakerMuted, .speakerLow, .speakerMid, .speakerHigh:
            p.polyline(
                [(3.4, 8.2), (6, 8.2), (9.6, 5), (9.6, 15), (6, 11.8), (3.4, 11.8)],
                closed: true
            )
            switch kind {
            case .speakerMuted:
                p.line(12.6, 8, 16.6, 12)
                p.line(16.6, 8, 12.6, 12)
            case .speakerHigh:
                p.arc(from: (12.2, 7.8), to: (12.2, 12.2), control: (14.2, 10))
                p.arc(from: (14.4, 5.4), to: (14.4, 14.6), control: (18.4, 10))
            case .speakerMid:
                p.arc(from: (12.2, 7.8), to: (12.2, 12.2), control: (14.2, 10))
            default:
                break
            }
        case .more:
            p.circle(4.8, 10, 0.5)
            p.circle(10, 10, 0.5)
            p.circle(15.2, 10, 0.5)

        case .close:
            p.line(5.6, 5.6, 14.4, 14.4)
            p.line(14.4, 5.6, 5.6, 14.4)
        case .splitPane:
            p.rounded(3, 4.4, 14, 11.2, 2.4)
            p.line(10, 4.4, 10, 15.6)

        case .projects:
            p.rounded(3.5, 3.5, 5.4, 5.4, 1.6)
            p.rounded(11.1, 3.5, 5.4, 5.4, 1.6)
            p.rounded(3.5, 11.1, 5.4, 5.4, 1.6)
            p.rounded(11.1, 11.1, 5.4, 5.4, 1.6)
        case .chevronRight:
            p.polyline([(7.6, 5.2), (12.4, 10), (7.6, 14.8)])
        case .chevronDown:
            p.polyline([(5.2, 7.6), (10, 12.4), (14.8, 7.6)])
        case .layoutStandard:
            // Tools and preview side by side, the timeline across the bottom.
            p.rounded(3, 3.6, 14, 12.8, 2.4)
            p.line(3, 11, 17, 11)
            p.line(10, 3.6, 10, 11)
        case .layoutTallPreview:
            // The preview the full height of the window on the right.
            p.rounded(3, 3.6, 14, 12.8, 2.4)
            p.line(11.4, 3.6, 11.4, 16.4)
            p.line(3, 10.4, 11.4, 10.4)
        case .note:
            p.circle(6.6, 14.2, 2.2)
            p.circle(14, 12.6, 2.2)
            p.polyline([(8.8, 14.2), (8.8, 5.2), (16.2, 3.8), (16.2, 12.6)])
        case .plus, .minus:
            p.line(4.6, 10, 15.4, 10)
            if kind == .plus { p.line(10, 4.6, 10, 15.4) }
        case .export:
            // Out of the tray and up.
            p.polyline([(3.8, 11.6), (3.8, 14.6), (5.6, 16.4), (14.4, 16.4), (16.2, 14.6), (16.2, 11.6)])
            p.line(10, 12.4, 10, 3.6)
            p.polyline([(6.6, 7), (10, 3.6), (13.4, 7)])
        case .play:
            p.polyline([(6.4, 4.4), (15.6, 10), (6.4, 15.6)], closed: true)
        case .check:
            p.polyline([(4.8, 10.6), (8.4, 14.2), (15.2, 6.2)])
        case .stop:
            p.polyline([(5.6, 5.6), (14.4, 5.6), (14.4, 14.4), (5.6, 14.4)], closed: true)
        case .pause:
            p.line(7, 4.8, 7, 15.2)
            p.line(13, 4.8, 13, 15.2)
        case .fullScreen:
            p.polyline([(11.6, 3.8), (16.2, 3.8), (16.2, 8.4)])
            p.line(16.2, 3.8, 11.4, 8.6)
            p.polyline([(8.4, 16.2), (3.8, 16.2), (3.8, 11.6)])
            p.line(3.8, 16.2, 8.6, 11.4)
        case .exitFullScreen:
            p.polyline([(11.6, 4), (11.6, 8.4), (16, 8.4)])
            p.line(11.6, 8.4, 16.2, 3.8)
            p.polyline([(8.4, 16), (8.4, 11.6), (4, 11.6)])
            p.line(8.4, 11.6, 3.8, 16.2)
        case .aspect:
            p.rounded(3, 5, 14, 10, 2.2)
            p.polyline([(6, 9.4), (6, 8), (7.4, 8)])
            p.polyline([(14, 10.6), (14, 12), (12.6, 12)])
        }
    }
}
