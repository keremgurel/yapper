import AppKit

/// A transparent strip sitting ON TOP of a split view's divider.
///
/// `additionalEffectiveRectOfDividerAt` widens where a drag counts, but it does
/// not decide the cursor: the panes are SwiftUI hosting views, and whichever
/// view lies under the pointer sets the cursor, so the resize arrows never
/// showed. Being above the panes makes both the cursor and the drag
/// unambiguously this view's, whatever the panes are made of.
final class SplitDividerGrabber: CursorRegionView {
    var isVertical = true {
        didSet { cursor = resizeCursor }
    }
    var onReset: (() -> Void)?

    /// Lit while the pointer is over the strip. A divider should be quiet until
    /// you go near it, and unmistakable the moment you do.
    private var isHighlighted = false {
        didSet {
            guard isHighlighted != oldValue else { return }
            needsDisplay = true
        }
    }

    private var splitView: NSSplitView? {
        superview?.subviews.compactMap { $0 as? NSSplitView }.first
    }

    private var resizeCursor: NSCursor {
        isVertical ? .resizeLeftRight : .resizeUpDown
    }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        cursor = resizeCursor
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    override func mouseEntered(with event: NSEvent) {
        super.mouseEntered(with: event)
        isHighlighted = true
    }

    override func mouseExited(with event: NSEvent) {
        super.mouseExited(with: event)
        isHighlighted = false
    }

    /// Draws the divider brighter under the pointer. The hairline itself stays
    /// as thin as it was: what changes is how clearly it says "drag me".
    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard isHighlighted else { return }
        NSColor.controlAccentColor.withAlphaComponent(0.55).setFill()
        let line = isVertical
            ? NSRect(x: bounds.midX - 1.5, y: bounds.minY, width: 3, height: bounds.height)
            : NSRect(x: bounds.minX, y: bounds.midY - 1.5, width: bounds.width, height: 3)
        NSBezierPath(roundedRect: line, xRadius: 1.5, yRadius: 1.5).fill()
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    /// Drags the divider directly. `NSSplitView`'s own tracking only starts
    /// from inside the hairline, which is the target that was too small in the
    /// first place, so this runs the drag loop itself and lets `setPosition`
    /// apply the delegate's minimum-size constraints.
    override func mouseDown(with event: NSEvent) {
        guard let splitView, splitView.subviews.count >= 2 else { return }
        if event.clickCount == 2 {
            onReset?()
            return
        }
        let leading = splitView.subviews[0].frame
        let start = splitView.convert(event.locationInWindow, from: nil)
        let grabOffset = isVertical ? start.x - leading.maxX : start.y - leading.maxY

        var lastPosition: CGFloat?
        while let next = window?.nextEvent(matching: [.leftMouseDragged, .leftMouseUp]) {
            if next.type == .leftMouseUp { break }
            // Laying both panes out takes longer than the gap between two drag
            // events, so they pile up and every one of them is paid for even
            // though only the newest says where the divider is now. Sampled
            // during a drag, this loop was a quarter of everything the app did.
            var latest = next
            while let queued = window?.nextEvent(
                matching: .leftMouseDragged,
                until: .distantPast,
                inMode: .eventTracking,
                dequeue: true
            ) {
                latest = queued
            }
            let point = splitView.convert(latest.locationInWindow, from: nil)
            let position = ((isVertical ? point.x : point.y) - grabOffset).rounded()
            guard position != lastPosition else { continue }
            lastPosition = position
            splitView.setPosition(position, ofDividerAt: 0)
        }
    }
}

/// Hosts a split view with a grab strip laid over its divider.
final class SplitContainerView: NSView {
    let splitView: StudioSplitView
    private let grabber = SplitDividerGrabber()

    /// Matches `NSSplitView`, so divider geometry needs no conversion.
    override var isFlipped: Bool { true }

    /// The container fills whatever it is given. Offering an intrinsic size
    /// invites AppKit to work one out, which means solving constraints for
    /// every view in both panes.
    override var intrinsicContentSize: NSSize {
        NSSize(width: NSView.noIntrinsicMetric, height: NSView.noIntrinsicMetric)
    }

    init(splitView: StudioSplitView) {
        self.splitView = splitView
        super.init(frame: .zero)
        grabber.isVertical = splitView.isVertical
        grabber.onReset = { [weak splitView] in splitView?.resetPosition?() }
        addSubview(splitView)
        addSubview(grabber)
        // Dragging the divider resizes the panes without ever changing this
        // view's bounds, so `layout()` alone would leave the strip stranded
        // where the divider used to be.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(positionGrabber),
            name: NSSplitView.didResizeSubviewsNotification,
            object: splitView
        )
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    override func layout() {
        super.layout()
        splitView.frame = bounds
        // The pane frames are read below, so they have to be settled first.
        splitView.layoutSubtreeIfNeeded()
        positionGrabber()
    }

    @objc private func positionGrabber() {
        guard splitView.subviews.count >= 2 else {
            grabber.isHidden = true
            return
        }
        grabber.isHidden = false
        grabber.isVertical = splitView.isVertical
        let leading = splitView.subviews[0].frame
        let padding = SplitDividerHitArea.padding
        let span = splitView.dividerThickness + padding * 2
        grabber.frame = splitView.isVertical
            ? NSRect(x: leading.maxX - padding, y: 0, width: span, height: bounds.height)
            : NSRect(x: 0, y: leading.maxY - padding, width: bounds.width, height: span)
    }
}
