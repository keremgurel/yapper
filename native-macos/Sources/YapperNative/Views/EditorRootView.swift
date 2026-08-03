import AppKit
import SwiftUI

enum EditorLayoutMode: String, CaseIterable, Identifiable {
    case standard
    case tallPreview

    var id: String { rawValue }

    var title: String {
        switch self {
        case .standard: "Standard layout"
        case .tallPreview: "Tall preview"
        }
    }

    var icon: String {
        switch self {
        case .standard: "rectangle.split.2x1"
        case .tallPreview: "rectangle.portrait.on.rectangle.portrait"
        }
    }

}

struct EditorRootView: View {
    @ObservedObject var session: EditorSession
    var embedded = false
    @AppStorage("editorLayoutMode") private var layoutModeRaw = EditorLayoutMode.tallPreview.rawValue

    private var layoutMode: EditorLayoutMode {
        EditorLayoutMode(rawValue: layoutModeRaw) ?? .tallPreview
    }

    var body: some View {
        VStack(spacing: 0) {
            if !embedded {
                EditorHeader(session: session)
                Divider().overlay(Color.studioLine)
            }
            if layoutMode == .tallPreview {
                EditorHorizontalWorkspace(session: session, layoutMode: layoutMode) {
                    VSplitView {
                        WorkbenchPanel(session: session)
                            .frame(minHeight: 320, idealHeight: 610)

                        TimelinePanel(session: session)
                            .frame(minHeight: 230, idealHeight: 330)
                    }
                }
            } else {
                VSplitView {
                    EditorHorizontalWorkspace(session: session, layoutMode: layoutMode) {
                        WorkbenchPanel(session: session)
                    }
                    .frame(minHeight: 390, idealHeight: 610)

                    TimelinePanel(session: session)
                        .frame(minHeight: 230, idealHeight: 320)
                }
            }
        }
        .background(Color.editorBackground)
        .alert(
            "Yapper needs attention",
            isPresented: Binding(
                get: { session.errorMessage != nil },
                set: { if !$0 { session.dismissError() } }
            )
        ) {
            Button("OK", role: .cancel) { session.dismissError() }
        } message: {
            Text(session.errorMessage ?? "Unknown error")
        }
    }
}

private struct EditorHorizontalWorkspace<LeftContent: View>: View {
    @ObservedObject var session: EditorSession
    let layoutMode: EditorLayoutMode
    @ViewBuilder let leftContent: LeftContent

    var body: some View {
        NativeEditorSplitView(
            session: session,
            layoutMode: layoutMode,
            leftContent: leftContent
        )
    }
}

private final class EditorNativeSplitView: NSSplitView {
    var resetPosition: (() -> Void)?

    override var dividerThickness: CGFloat { 7 }

    override func drawDivider(in rect: NSRect) {
        NSColor.separatorColor.withAlphaComponent(0.7).setFill()
        NSRect(x: rect.midX - 0.5, y: rect.minY, width: 1, height: rect.height).fill()
    }

    override func mouseDown(with event: NSEvent) {
        if event.clickCount == 2 {
            resetPosition?()
            return
        }
        super.mouseDown(with: event)
    }
}

private struct NativeEditorSplitView<LeftContent: View>: NSViewRepresentable {
    let session: EditorSession
    let layoutMode: EditorLayoutMode
    let leftContent: LeftContent

    func makeCoordinator() -> Coordinator {
        Coordinator(
            layoutMode: layoutMode,
            aspectRatio: session.project.resolvedAspectRatio
        )
    }

    func makeNSView(context: Context) -> EditorNativeSplitView {
        let splitView = EditorNativeSplitView()
        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.delegate = context.coordinator
        splitView.wantsLayer = true
        splitView.layer?.actions = [
            "bounds": NSNull(),
            "position": NSNull(),
            "sublayers": NSNull(),
        ]

        let workbench = NSHostingView(rootView: leftContent)
        let preview = NSHostingView(
            rootView: PlayerPanel(session: session, layoutMode: layoutMode)
        )
        workbench.identifier = NSUserInterfaceItemIdentifier("YapperEditorWorkbench")
        preview.identifier = NSUserInterfaceItemIdentifier("YapperEditorPreview")
        workbench.wantsLayer = true
        preview.wantsLayer = true
        workbench.layer?.actions = ["bounds": NSNull(), "position": NSNull()]
        preview.layer?.actions = ["bounds": NSNull(), "position": NSNull()]

        splitView.addArrangedSubview(workbench)
        splitView.addArrangedSubview(preview)
        splitView.setHoldingPriority(.defaultLow, forSubviewAt: 0)
        splitView.setHoldingPriority(.defaultHigh, forSubviewAt: 1)
        splitView.resetPosition = { [weak splitView, weak coordinator = context.coordinator] in
            guard let splitView, let coordinator else { return }
            coordinator.resetPosition(in: splitView)
        }

        context.coordinator.splitView = splitView
        context.coordinator.scheduleInitialPosition()
        return splitView
    }

    func updateNSView(_ splitView: EditorNativeSplitView, context: Context) {
        context.coordinator.aspectRatio = session.project.resolvedAspectRatio
        context.coordinator.scheduleInitialPosition()
    }

    static func dismantleNSView(_ splitView: EditorNativeSplitView, coordinator: Coordinator) {
        splitView.delegate = nil
        splitView.resetPosition = nil
    }

    @MainActor
    final class Coordinator: NSObject, NSSplitViewDelegate {
        weak var splitView: NSSplitView?
        let layoutMode: EditorLayoutMode
        var aspectRatio: Double
        private var appliedInitialPosition = false
        private var applyingProgrammaticPosition = false

        private var defaultsKey: String {
            layoutMode == .standard
                ? "editorStandardWorkbenchFraction"
                : "editorTallWorkbenchFraction"
        }

        init(layoutMode: EditorLayoutMode, aspectRatio: Double) {
            self.layoutMode = layoutMode
            self.aspectRatio = aspectRatio
        }

        func scheduleInitialPosition() {
            guard !appliedInitialPosition else { return }
            DispatchQueue.main.async { [weak self] in
                guard let self, let splitView, !appliedInitialPosition else { return }
                guard splitView.bounds.width > splitView.dividerThickness + 1 else { return }
                applyPosition(in: splitView, useStoredPosition: true)
                appliedInitialPosition = true
            }
        }

        func resetPosition(in splitView: NSSplitView) {
            UserDefaults.standard.set(0.0, forKey: defaultsKey)
            applyPosition(in: splitView, useStoredPosition: false)
        }

        private func applyPosition(in splitView: NSSplitView, useStoredPosition: Bool) {
            let availableWidth = max(1, splitView.bounds.width - splitView.dividerThickness)
            let stored = UserDefaults.standard.double(forKey: defaultsKey)
            let fraction = useStoredPosition && stored > 0
                ? clampedFraction(stored, availableWidth: availableWidth)
                : automaticFraction(in: splitView, availableWidth: availableWidth)

            applyingProgrammaticPosition = true
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0
                context.allowsImplicitAnimation = false
                splitView.setPosition(availableWidth * fraction, ofDividerAt: 0)
                splitView.layoutSubtreeIfNeeded()
            }
            applyingProgrammaticPosition = false
            UserDefaults.standard.set(fraction, forKey: defaultsKey)
        }

        private func automaticFraction(
            in splitView: NSSplitView,
            availableWidth: CGFloat
        ) -> Double {
            let transportHeight: CGFloat = 40
            let previewPadding: CGFloat = layoutMode == .standard ? 36 : 20
            let availableStageHeight = max(1, splitView.bounds.height - transportHeight - previewPadding)
            let desiredPreviewWidth = max(
                layoutMode == .standard ? 480 : 330,
                availableStageHeight * CGFloat(aspectRatio) + previewPadding
            )
            let proposed = (availableWidth - desiredPreviewWidth) / availableWidth
            return clampedFraction(proposed, availableWidth: availableWidth)
        }

        private func clampedFraction(_ value: Double, availableWidth: CGFloat) -> Double {
            let minimumWorkbench = min(390, availableWidth * 0.46)
            let minimumPreview = min(layoutMode == .standard ? 440 : 310, availableWidth * 0.46)
            let lower = minimumWorkbench / availableWidth
            let upper = max(lower, 1 - minimumPreview / availableWidth)
            return min(upper, max(lower, value))
        }

        func splitView(
            _ splitView: NSSplitView,
            constrainMinCoordinate proposedMinimumPosition: CGFloat,
            ofSubviewAt dividerIndex: Int
        ) -> CGFloat {
            let availableWidth = max(1, splitView.bounds.width - splitView.dividerThickness)
            return min(390, availableWidth * 0.46)
        }

        func splitView(
            _ splitView: NSSplitView,
            constrainMaxCoordinate proposedMaximumPosition: CGFloat,
            ofSubviewAt dividerIndex: Int
        ) -> CGFloat {
            let availableWidth = max(1, splitView.bounds.width - splitView.dividerThickness)
            let minimumPreview = min(layoutMode == .standard ? 440 : 310, availableWidth * 0.46)
            return availableWidth - minimumPreview
        }

        func splitViewDidResizeSubviews(_ notification: Notification) {
            guard
                !applyingProgrammaticPosition,
                let splitView = notification.object as? NSSplitView,
                splitView.subviews.count >= 2
            else { return }
            let availableWidth = max(1, splitView.bounds.width - splitView.dividerThickness)
            let fraction = clampedFraction(
                splitView.subviews[0].frame.width / availableWidth,
                availableWidth: availableWidth
            )
            UserDefaults.standard.set(fraction, forKey: defaultsKey)
        }
    }
}

private struct EditorHeader: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.yapperOrange)
                Image(systemName: "waveform.path.ecg")
                    .font(.system(size: 15, weight: .black))
                    .foregroundStyle(.black)
            }
            .frame(width: 30, height: 30)

            VStack(alignment: .leading, spacing: 1) {
                Text("Yapper Studio")
                    .font(.system(size: 13, weight: .bold))
                Text(session.project.name)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            if session.isBusy || session.isExporting {
                ProgressView()
                    .controlSize(.small)
            }
            Text(session.statusMessage)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)

            Button {
                ImportPanels.openMedia(for: session)
            } label: {
                Label("Import", systemImage: "plus")
            }
            .buttonStyle(EditorSecondaryButtonStyle())

            Button {
                ImportPanels.saveExport(for: session)
            } label: {
                Label("Export", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(EditorPrimaryButtonStyle())
            .disabled(session.project.clips.isEmpty || session.isExporting)
        }
        .padding(.horizontal, 16)
        .frame(height: 52)
        .background(Color.panelBackground)
    }
}

struct EditorPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(.black)
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(
                Color.yapperOrange.opacity(
                    isEnabled ? (configuration.isPressed ? 0.78 : 1) : 0.38
                )
            )
            .opacity(isEnabled ? 1 : 0.72)
            .clipShape(RoundedRectangle(cornerRadius: 7))
    }
}

struct EditorSecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.primary)
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background(Color.studioFaintFill.opacity(configuration.isPressed ? 1.6 : 1))
            .overlay(
                RoundedRectangle(cornerRadius: 7)
                    .stroke(Color.studioLine, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .opacity(isEnabled ? 1 : 0.42)
    }
}
