import AppKit
import SwiftUI

/// Puts a cursor over a view, and keeps it there.
///
/// `onHover` plus `NSCursor.set()` looks right until something else redraws:
/// SwiftUI resets the cursor whenever it feels like it, so the pointer flickers
/// back to an arrow while the mouse has not moved. A tracking area is the only
/// thing AppKit takes as the last word, which is what this installs.
struct CursorArea: NSViewRepresentable {
    let cursor: NSCursor

    func makeNSView(context: Context) -> CursorTrackingView {
        let view = CursorTrackingView()
        view.cursor = cursor
        return view
    }

    func updateNSView(_ nsView: CursorTrackingView, context: Context) {
        nsView.cursor = cursor
    }
}

/// A cursor region that never takes a click: it only decides what the pointer
/// looks like, and whatever is underneath still gets every event.
final class CursorTrackingView: CursorRegionView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}

extension View {
    /// The pointer to show over this view. Sits on top without taking clicks.
    func cursor(_ cursor: NSCursor) -> some View {
        overlay(CursorArea(cursor: cursor))
    }

    /// What anything clickable gets: the hand, so a control looks like one.
    /// A disabled control is not clickable, so it keeps the arrow.
    func clickableCursor(enabled: Bool = true) -> some View {
        cursor(enabled ? .pointingHand : .arrow)
    }
}
