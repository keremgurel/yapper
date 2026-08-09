import AppKit
import SwiftUI

/// Keeps the editor's local view state alive while a cloud page is open,
/// without resizing the entire hidden editor tree on every window frame.
///
/// An opacity-zero SwiftUI view still participates in layout. The editor has
/// several split panes, a timeline and a video canvas, so keeping it full-size
/// behind WKWebView made resizing Idea Bank (and every other cloud surface)
/// pay for both applications. This host parks the editor at its last active
/// size and only lays it out again when it becomes visible.
struct PersistentEditorHost: NSViewRepresentable {
    let session: EditorSession
    let isActive: Bool

    func makeNSView(context: Context) -> Container {
        Container(session: session, isActive: isActive)
    }

    func updateNSView(_ container: Container, context: Context) {
        container.setActive(isActive)
    }

    func sizeThatFits(
        _ proposal: ProposedViewSize,
        nsView: Container,
        context: Context
    ) -> CGSize? {
        proposal.replacingUnspecifiedDimensions()
    }

    @MainActor
    final class Container: NSView {
        private let editor: NSHostingView<EditorRootView>
        private var isActive: Bool
        private var lastActiveSize = CGSize(width: 1_100, height: 700)

        init(session: EditorSession, isActive: Bool) {
            self.isActive = isActive
            editor = NSHostingView(
                rootView: EditorRootView(session: session, embedded: true)
            )
            super.init(frame: .zero)
            wantsLayer = true
            layer?.actions = ["bounds": NSNull(), "position": NSNull()]
            editor.sizingOptions = []
            editor.wantsLayer = true
            editor.layer?.actions = ["bounds": NSNull(), "position": NSNull()]
            addSubview(editor)
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) { nil }

        override func layout() {
            super.layout()
            guard isActive else { return }
            if bounds.width > 1, bounds.height > 1 {
                lastActiveSize = bounds.size
            }
            editor.frame = bounds
        }

        func setActive(_ active: Bool) {
            guard active != isActive else { return }
            isActive = active
            if active {
                editor.frame = bounds
                needsLayout = true
                layoutSubtreeIfNeeded()
            } else {
                // Offset rather than hide: hiding an NSHostingView can suspend
                // rendering and produce a stale first frame when returning.
                editor.frame = CGRect(
                    x: -50_000,
                    y: 0,
                    width: lastActiveSize.width,
                    height: lastActiveSize.height
                )
            }
        }
    }
}
