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

    var previewAspectRatio: CGFloat {
        switch self {
        case .standard: 16 / 9
        case .tallPreview: 9 / 16
        }
    }
}

struct EditorRootView: View {
    @ObservedObject var session: EditorSession
    var embedded = false
    @AppStorage("editorLayoutMode") private var layoutModeRaw = EditorLayoutMode.standard.rawValue

    private var layoutMode: EditorLayoutMode {
        EditorLayoutMode(rawValue: layoutModeRaw) ?? .standard
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
    @AppStorage("editorStandardWorkbenchFraction") private var standardWorkbenchFraction = 0.0
    @AppStorage("editorTallWorkbenchFraction") private var tallWorkbenchFraction = 0.0
    @State private var dragStartFraction: Double?

    private let dividerWidth: CGFloat = 7

    var body: some View {
        GeometryReader { proxy in
            let fraction = resolvedWorkbenchFraction(in: proxy.size)
            let workbenchWidth = max(0, (proxy.size.width - dividerWidth) * fraction)

            HStack(spacing: 0) {
                leftContent
                    .frame(width: workbenchWidth)
                    .frame(maxHeight: .infinity)

                EditorPanelDivider(
                    onDrag: { translation in
                        if dragStartFraction == nil {
                            dragStartFraction = fraction
                        }
                        let availableWidth = max(1, proxy.size.width - dividerWidth)
                        let next = (dragStartFraction ?? fraction) + translation / availableWidth
                        setWorkbenchFraction(clamp(next, in: proxy.size))
                    },
                    onEnd: {
                        dragStartFraction = nil
                    },
                    onReset: {
                        withAnimation(.easeInOut(duration: 0.22)) {
                            setWorkbenchFraction(0)
                        }
                    }
                )
                .frame(width: dividerWidth)

                PlayerPanel(session: session, layoutMode: layoutMode)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .animation(.easeInOut(duration: 0.22), value: layoutMode)
        }
    }

    private func resolvedWorkbenchFraction(in size: CGSize) -> Double {
        let stored = layoutMode == .standard
            ? standardWorkbenchFraction
            : tallWorkbenchFraction
        if stored > 0 {
            return clamp(stored, in: size)
        }

        let previewChrome: CGFloat = 50
        let desiredPreviewWidth = max(
            layoutMode == .standard ? 480 : 330,
            (size.height - previewChrome) * layoutMode.previewAspectRatio
        )
        let automatic = (size.width - dividerWidth - desiredPreviewWidth)
            / max(1, size.width - dividerWidth)
        return clamp(automatic, in: size)
    }

    private func clamp(_ value: Double, in size: CGSize) -> Double {
        let availableWidth = max(1, size.width - dividerWidth)
        let minimumWorkbench = min(390, availableWidth * 0.46)
        let minimumPreview = min(layoutMode == .standard ? 440 : 310, availableWidth * 0.46)
        let lower = minimumWorkbench / availableWidth
        let upper = max(lower, 1 - minimumPreview / availableWidth)
        return min(upper, max(lower, value))
    }

    private func setWorkbenchFraction(_ value: Double) {
        if layoutMode == .standard {
            standardWorkbenchFraction = value
        } else {
            tallWorkbenchFraction = value
        }
    }
}

private struct EditorPanelDivider: View {
    let onDrag: (CGFloat) -> Void
    let onEnd: () -> Void
    let onReset: () -> Void
    @State private var hovering = false

    var body: some View {
        ZStack {
            Color.panelBackground
            RoundedRectangle(cornerRadius: 1.5)
                .fill(hovering ? Color.yapperOrange.opacity(0.72) : Color.studioLine)
                .frame(width: hovering ? 3 : 1)
        }
        .contentShape(Rectangle())
        .onHover { hovering = $0 }
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { onDrag($0.translation.width) }
                .onEnded { _ in onEnd() }
        )
        .onTapGesture(count: 2, perform: onReset)
        .animation(.easeOut(duration: 0.1), value: hovering)
        .help("Drag to resize · double-click to fit preview")
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
