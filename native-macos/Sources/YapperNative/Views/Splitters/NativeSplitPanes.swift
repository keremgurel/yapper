import AppKit
import SwiftUI

/// Two panes with a draggable divider between them.
///
/// This exists instead of SwiftUI's `VSplitView` because that control gives no
/// way to enlarge the divider's grab region, which on a hairline divider is a
/// few points of nearly unhittable target. Backing it with `NSSplitView` buys
/// the enlarged hit area, a remembered position, and double-click to reset.
struct NativeSplitPanes<First: View, Second: View>: NSViewRepresentable {
    /// True lays the panes side by side; false stacks them.
    let isVertical: Bool
    let minimumFirst: CGFloat
    let minimumSecond: CGFloat
    /// Where the divider sits on a first run, as a fraction of the split axis.
    let defaultFraction: Double
    let defaultsKey: String
    @ViewBuilder let first: First
    @ViewBuilder let second: Second

    func makeCoordinator() -> Coordinator {
        Coordinator(
            isVertical: isVertical,
            minimumFirst: minimumFirst,
            minimumSecond: minimumSecond,
            defaultFraction: defaultFraction,
            defaultsKey: defaultsKey
        )
    }

    func makeNSView(context: Context) -> SplitContainerView {
        let splitView = StudioSplitView()
        splitView.isVertical = isVertical
        splitView.dividerStyle = .thin
        splitView.delegate = context.coordinator

        for pane in [NSHostingView(rootView: AnyView(first)), NSHostingView(rootView: AnyView(second))] {
        // A hosting view reports a fitting size by default, and asking for one
        // makes AppKit build an Auto Layout engine over everything inside it.
        // A pane in a split view is told its size, so it never needs to offer
        // one: this is what a sample showed the divider drag spending its time
        // on, solving constraints for the whole editor on every frame.
        pane.sizingOptions = []
            pane.wantsLayer = true
            pane.layer?.actions = ["bounds": NSNull(), "position": NSNull()]
            splitView.addArrangedSubview(pane)
        }
        splitView.setHoldingPriority(.defaultLow, forSubviewAt: 0)
        splitView.setHoldingPriority(.defaultHigh, forSubviewAt: 1)

        splitView.resetPosition = { [weak splitView, weak coordinator = context.coordinator] in
            guard let splitView, let coordinator else { return }
            coordinator.resetPosition(in: splitView)
        }
        context.coordinator.splitView = splitView
        context.coordinator.scheduleInitialPosition()
        return SplitContainerView(splitView: splitView)
    }

    func updateNSView(_ container: SplitContainerView, context: Context) {
        context.coordinator.scheduleInitialPosition()
    }

    /// Takes whatever it is offered. Without this SwiftUI measures the split
    /// view before laying it out, and measuring an AppKit view means a full
    /// constraint solve over its subtree.
    func sizeThatFits(
        _ proposal: ProposedViewSize,
        nsView: SplitContainerView,
        context: Context
    ) -> CGSize? {
        proposal.replacingUnspecifiedDimensions()
    }

    static func dismantleNSView(_ container: SplitContainerView, coordinator: Coordinator) {
        container.splitView.delegate = nil
        container.splitView.resetPosition = nil
    }

    @MainActor
    final class Coordinator: NSObject, NSSplitViewDelegate {
        weak var splitView: NSSplitView?
        private let isVertical: Bool
        private let minimumFirst: CGFloat
        private let minimumSecond: CGFloat
        private let defaultFraction: Double
        private let defaultsKey: String
        private var appliedInitialPosition = false
        private var applyingProgrammaticPosition = false
        /// The divider's resting place, written once the drag settles.
        private var positionWriteTask: Task<Void, Never>?

        init(
            isVertical: Bool,
            minimumFirst: CGFloat,
            minimumSecond: CGFloat,
            defaultFraction: Double,
            defaultsKey: String
        ) {
            self.isVertical = isVertical
            self.minimumFirst = minimumFirst
            self.minimumSecond = minimumSecond
            self.defaultFraction = defaultFraction
            self.defaultsKey = defaultsKey
        }

        private func available(in splitView: NSSplitView) -> CGFloat {
            let total = isVertical ? splitView.bounds.width : splitView.bounds.height
            return max(1, total - splitView.dividerThickness)
        }

        func scheduleInitialPosition() {
            guard !appliedInitialPosition else { return }
            DispatchQueue.main.async { [weak self] in
                guard let self, let splitView, !appliedInitialPosition else { return }
                guard available(in: splitView) > 1 else { return }
                applyPosition(in: splitView, useStoredPosition: true)
                appliedInitialPosition = true
            }
        }

        func resetPosition(in splitView: NSSplitView) {
            UserDefaults.standard.set(0.0, forKey: defaultsKey)
            applyPosition(in: splitView, useStoredPosition: false)
        }

        private func applyPosition(in splitView: NSSplitView, useStoredPosition: Bool) {
            let span = available(in: splitView)
            let stored = UserDefaults.standard.double(forKey: defaultsKey)
            let fraction = clamped(
                useStoredPosition && stored > 0 ? stored : defaultFraction,
                span: span
            )
            applyingProgrammaticPosition = true
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0
                context.allowsImplicitAnimation = false
                splitView.setPosition(span * fraction, ofDividerAt: 0)
                splitView.layoutSubtreeIfNeeded()
            }
            applyingProgrammaticPosition = false
            UserDefaults.standard.set(fraction, forKey: defaultsKey)
        }

        private func clamped(_ value: Double, span: CGFloat) -> Double {
            let lower = min(minimumFirst, span * 0.5) / span
            let upper = max(lower, 1 - min(minimumSecond, span * 0.5) / span)
            return min(upper, max(lower, value))
        }

        func splitView(
            _ splitView: NSSplitView,
            constrainMinCoordinate proposedMinimumPosition: CGFloat,
            ofSubviewAt dividerIndex: Int
        ) -> CGFloat {
            min(minimumFirst, available(in: splitView) * 0.5)
        }

        func splitView(
            _ splitView: NSSplitView,
            constrainMaxCoordinate proposedMaximumPosition: CGFloat,
            ofSubviewAt dividerIndex: Int
        ) -> CGFloat {
            let span = available(in: splitView)
            return span - min(minimumSecond, span * 0.5)
        }

        func splitView(
            _ splitView: NSSplitView,
            additionalEffectiveRectOfDividerAt dividerIndex: Int
        ) -> NSRect {
            SplitDividerHitArea.additionalRect(in: splitView, dividerIndex: dividerIndex)
        }

        func splitViewDidResizeSubviews(_ notification: Notification) {
            guard
                !applyingProgrammaticPosition,
                let splitView = notification.object as? NSSplitView,
                splitView.subviews.count >= 2
            else { return }
            let span = available(in: splitView)
            let leading = isVertical
                ? splitView.subviews[0].frame.width
                : splitView.subviews[0].frame.height
            rememberPosition(clamped(leading / span, span: span))
        }

        /// Dragging a divider calls back on every frame, and writing user
        /// defaults on every one of those goes out to the preferences daemon
        /// over and over. The last position is the only one worth keeping, so
        /// the write waits for the drag to settle.
        private func rememberPosition(_ fraction: Double) {
            positionWriteTask?.cancel()
            positionWriteTask = Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(400))
                guard !Task.isCancelled, let self else { return }
                UserDefaults.standard.set(fraction, forKey: defaultsKey)
            }
        }
    }
}
