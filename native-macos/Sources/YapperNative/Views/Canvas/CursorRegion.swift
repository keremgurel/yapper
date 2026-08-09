import AppKit

/// A view that owns the pointer's shape while it is over it.
///
/// Two things make this harder than `addCursorRect` suggests.
///
/// SwiftUI sets the cursor itself whenever a hosting view redraws or its own
/// hover state changes, so a cursor set once on entry is taken away again the
/// moment the pointer moves. The cure is to keep asserting it: the tracking
/// area asks for `.mouseMoved`, and the window is told to deliver those.
///
/// And regions overlap. A trim handle sits on top of a clip that wants a
/// pointing hand, and both are told the pointer moved, so whichever answered
/// last used to win. `CursorRegions` settles it by picking the region that is
/// actually on top.
class CursorRegionView: NSView {
    var cursor: NSCursor = .arrow {
        didSet {
            guard cursor != oldValue else { return }
            window?.invalidateCursorRects(for: self)
            CursorRegions.shared.apply(in: window)
        }
    }

    private var trackingArea: NSTrackingArea?

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window != nil {
            CursorRegions.shared.register(self)
        } else {
            CursorRegions.shared.unregister(self)
        }
    }

    override func resetCursorRects() {
        addCursorRect(bounds, cursor: cursor)
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let trackingArea { removeTrackingArea(trackingArea) }
        let area = NSTrackingArea(
            rect: .zero,
            // `.cursorUpdate` already fires as the pointer moves inside the
            // area, which is all this needs. Asking for `.mouseMoved` meant
            // switching on window-wide mouse-moved delivery, and then every
            // hosting view in the editor woke up on every pointer movement:
            // dragging anything went through a pane-wide layout per mouse move.
            options: [
                .activeInKeyWindow,
                .inVisibleRect,
                .cursorUpdate,
                .mouseEnteredAndExited,
            ],
            owner: self
        )
        addTrackingArea(area)
        trackingArea = area
    }

    override func cursorUpdate(with event: NSEvent) { enter() }
    override func mouseEntered(with event: NSEvent) { enter() }

    override func mouseExited(with event: NSEvent) {
        CursorRegions.shared.pointerLeft(self)
    }

    private func enter() {
        CursorRegions.shared.pointerEntered(self)
    }
}

/// Decides which cursor region the pointer is really over, and keeps that
/// answer in place.
///
/// Setting the cursor once is not enough. Tracking areas take no notice of what
/// is in front of what, so the SwiftUI panes underneath a divider are told about
/// the same mouse moves we are, and whichever of us runs last decides the shape
/// of the pointer. That is what made the resize arrows flash and vanish.
///
/// So the winning cursor is re-asserted on a short timer for as long as the
/// pointer stays inside a region. The timer only runs while a region is under
/// the pointer, and all it does is set a cursor.
@MainActor
final class CursorRegions {
    static let shared = CursorRegions()

    /// Fast enough that a stolen cursor is never visible, slow enough to be
    /// free: this is one `NSCursor.set()` per tick.
    private static let assertionInterval = 0.05

    private let regions = NSHashTable<CursorRegionView>.weakObjects()
    /// Only the regions the pointer is actually inside. The editor has a region
    /// per clickable thing, and a transcript can hold thousands of them, so the
    /// front-most one is picked from the handful under the pointer rather than
    /// by measuring every region in the window.
    private let hovered = NSHashTable<CursorRegionView>.weakObjects()
    private weak var front: CursorRegionView?
    private var assertion: Timer?

    func register(_ region: CursorRegionView) { regions.add(region) }

    func unregister(_ region: CursorRegionView) {
        regions.remove(region)
        hovered.remove(region)
        if front === region { clear() }
    }

    func pointerEntered(_ region: CursorRegionView) {
        hovered.add(region)
        apply(in: region.window)
    }

    func pointerLeft(_ region: CursorRegionView) {
        hovered.remove(region)
        apply(in: region.window)
    }

    /// Sets the cursor belonging to the topmost region under the pointer, or
    /// the arrow when the pointer is over none of them.
    func apply(in window: NSWindow?) {
        guard let window, window.isKeyWindow else { return }
        let point = window.mouseLocationOutsideOfEventStream
        let candidates = hovered.allObjects.filter { region in
            region.window === window
                && !region.isHiddenOrHasHiddenAncestor
                && region.convert(region.bounds, to: nil).contains(point)
        }
        guard let winner = candidates.max(by: {
            Self.zPath(of: $0).lexicographicallyPrecedes(Self.zPath(of: $1))
        }) else {
            clear()
            return
        }
        front = winner
        winner.cursor.set()
        startAsserting()
    }

    private func startAsserting() {
        guard assertion == nil else { return }
        let timer = Timer(timeInterval: Self.assertionInterval, repeats: true) { _ in
            MainActor.assumeIsolated { CursorRegions.shared.assertFrontCursor() }
        }
        // Common modes, or the cursor would give up during a scroll or a drag,
        // which is exactly when it matters most.
        RunLoop.main.add(timer, forMode: .common)
        assertion = timer
    }

    private func assertFrontCursor() {
        guard
            let front,
            let window = front.window,
            window.isKeyWindow,
            !front.isHiddenOrHasHiddenAncestor,
            front.convert(front.bounds, to: nil).contains(window.mouseLocationOutsideOfEventStream)
        else {
            clear()
            return
        }
        front.cursor.set()
    }

    /// Hands the pointer back. Only resets the shape if this was the last thing
    /// to set it, so leaving a region never fights anything else.
    private func clear() {
        let hadFront = front != nil
        front = nil
        assertion?.invalidate()
        assertion = nil
        if hadFront { NSCursor.arrow.set() }
    }

    /// A view's position in the window's stack, as the chain of sibling indices
    /// from the top down. Later siblings draw over earlier ones, and a longer
    /// path with the same prefix is a descendant, so comparing these in order
    /// answers "which of these two is in front".
    static func zPath(of view: NSView) -> [Int] {
        var path: [Int] = []
        var current: NSView = view
        while let parent = current.superview {
            path.append(parent.subviews.firstIndex(of: current) ?? 0)
            current = parent
        }
        return path.reversed()
    }
}
