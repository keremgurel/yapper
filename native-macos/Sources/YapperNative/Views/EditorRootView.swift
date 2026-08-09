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
                    NativeSplitPanes(
                        isVertical: false,
                        minimumFirst: 320,
                        minimumSecond: 230,
                        defaultFraction: 0.65,
                        defaultsKey: "editorTallWorkbenchTimelineFraction"
                    ) {
                        WorkbenchPanel(session: session)
                    } second: {
                        TimelinePanel(session: session)
                    }
                }
            } else {
                NativeSplitPanes(
                    isVertical: false,
                    minimumFirst: 390,
                    minimumSecond: 230,
                    defaultFraction: 0.65,
                    defaultsKey: "editorStandardWorkspaceTimelineFraction"
                ) {
                    EditorHorizontalWorkspace(session: session, layoutMode: layoutMode) {
                        WorkbenchPanel(session: session)
                    }
                } second: {
                    TimelinePanel(session: session)
                }
            }
        }
        .background(Color.editorBackground)
        // Chirpy floats over the whole editor rather than living in a tab: what
        // you want to say is not the property of any one panel, and a thing you
        // can move is a thing that is never in the way.
        .overlay {
            FloatingAssistant(session: session, conversation: session.conversation)
        }
        // Cropping opens over the whole editor rather than inside the panel
        // that started it: it is opened from the bin, from the timeline and
        // from the inspector, and it is the same editor from all three.
        .sheet(item: $session.cropRequest) { request in
            CropSheet(session: session, request: request)
        }
        // Clicking away from a caption or a field puts the keyboard back where
        // the editor's own keys work, so Space plays instead of typing.
        .background(EndEditingOnOutsideClickView())
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

    func makeNSView(context: Context) -> SplitContainerView {
        let splitView = StudioSplitView()
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
        // Neither pane offers a fitting size: the split view tells them how
        // big they are. Left to report one, each drag frame solved Auto Layout
        // constraints for the whole subtree behind it.
        workbench.sizingOptions = []
        preview.sizingOptions = []
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
        return SplitContainerView(splitView: splitView)
    }

    func updateNSView(_ container: SplitContainerView, context: Context) {
        context.coordinator.aspectRatio = session.project.resolvedAspectRatio
        context.coordinator.scheduleInitialPosition()
        context.coordinator.refitIfAspectRatioChanged()
    }

    /// Takes whatever it is offered, so SwiftUI never asks the split view to
    /// measure itself. See `NativeSplitPanes` for the same note.
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
                // Tall preview exists to show the whole frame, so opening it
                // always fits the video to the full height rather than
                // reopening at whatever width the divider was last left at.
                // Dragging the divider still works, and still sticks, until the
                // mode is left and come back to.
                applyPosition(in: splitView, useStoredPosition: layoutMode == .standard)
                appliedInitialPosition = true
                fittedAspectRatio = aspectRatio
            }
        }

        /// The frame shape the current position was fitted to. A project that
        /// changes shape — nine by sixteen to one by one — has to be re-fitted,
        /// or the preview keeps the width the old shape needed.
        private var fittedAspectRatio: Double?

        func refitIfAspectRatioChanged() {
            guard
                appliedInitialPosition,
                let splitView,
                let fittedAspectRatio,
                abs(fittedAspectRatio - aspectRatio) > 0.000_1,
                splitView.bounds.width > splitView.dividerThickness + 1
            else { return }
            self.fittedAspectRatio = aspectRatio
            applyPosition(in: splitView, useStoredPosition: false)
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
