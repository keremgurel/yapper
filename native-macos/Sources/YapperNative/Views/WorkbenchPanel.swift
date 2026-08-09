import Foundation
import SwiftUI
import UniformTypeIdentifiers

private enum WorkbenchTab: String, CaseIterable, Identifiable {
    case media = "Media"
    case quick = "Quick Edit"
    case transcript = "Transcript"
    /// The speaker's own picture: how it sits in the frame, and how it moves.
    case video = "Video"
    case audio = "Audio"
    case text = "Text"
    case overlays = "Overlays"
    case captions = "Captions"
    case filters = "Filters"

    var id: String { rawValue }
    var icon: String {
        switch self {
        case .media: "film.stack"
        case .quick: "wand.and.stars"
        case .transcript: "doc.text"
        case .video: "video"
        case .audio: "waveform"
        case .text: "textformat"
        case .overlays: "rectangle.on.rectangle"
        case .captions: "captions.bubble"
        case .filters: "slider.horizontal.3"
        }
    }
}

private enum WorkbenchDockFocus {
    case primary
    case secondary
}

struct WorkbenchPanel: View {
    @ObservedObject var session: EditorSession
    @State private var selectedTab: WorkbenchTab = .media
    @State private var secondaryTab: WorkbenchTab?
    @State private var dockFocus: WorkbenchDockFocus = .primary
    @State private var tabOrder = WorkbenchTab.allCases
    @State private var panelDropTargeted = false
    @State private var draggingTab: WorkbenchTab?
    @State private var workbenchWidth: CGFloat = 0
    /// Set when the creator closes the second pane by hand. Without it, the
    /// pane would spring straight back the next time the panel is resized.
    @State private var secondaryPaneDismissed = false
    @AppStorage("workbenchTabOrder") private var tabOrderRaw = ""

    /// Below this the two panes cannot both hold their 300pt minimum, so the
    /// dock falls back to switching between them.
    private static let splitPaneWidth: CGFloat = 720

    var body: some View {
        VStack(spacing: 0) {
            workbenchTabStrip

            GeometryReader { proxy in
                ZStack {
                    // In steps, not points. The dock reads this to pick between
                    // one pane and two and to propose a split, neither of which
                    // changes within a step, and handing it the raw width
                    // rebuilt both panes and everything in them on every frame
                    // of a divider drag. See PaneSizeStep.
                    workbenchDock(width: PaneSizeStep.rounded(proxy.size.width))

                    if panelDropTargeted {
                        WorkbenchDropGuide()
                            .transition(.opacity.combined(with: .scale(scale: 0.985)))
                            .allowsHitTesting(false)
                    }
                }
                .contentShape(Rectangle())
                .onDrop(
                    of: [UTType.utf8PlainText.identifier],
                    delegate: WorkbenchDropDelegate(
                        isTargeted: $panelDropTargeted,
                        onDrop: { raw, location in
                            handlePanelDrop(raw, at: location, width: proxy.size.width)
                        }
                    )
                )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.panelBackground)
        .background {
            GeometryReader { proxy in
                Color.clear
                    .onAppear {
                        workbenchWidth = PaneSizeStep.rounded(proxy.size.width)
                        openSecondaryPaneIfRoomy()
                    }
                    // Stepped, and only written when the step changes. This is
                    // `@State` on the panel, so a write here rebuilds the tab
                    // strip, the dock and both panes: doing that per frame of a
                    // divider drag, for a number only ever compared against
                    // 720, was the most expensive thing a resize did.
                    .onChange(of: proxy.size.width) { _, width in
                        let stepped = PaneSizeStep.rounded(width)
                        guard stepped != workbenchWidth else { return }
                        workbenchWidth = stepped
                        openSecondaryPaneIfRoomy()
                    }
            }
        }
        .coordinateSpace(name: "workbenchDock")
        .onAppear(perform: restoreTabOrder)
        .onChange(of: session.project.clips.isEmpty) { wasEmpty, isEmpty in
            // The moment there is something on the timeline, Quick Edit is what
            // the creator wants next. It opens beside whatever they were on
            // rather than replacing it.
            guard wasEmpty, !isEmpty else { return }
            withAnimation(.easeOut(duration: 0.18)) { focusQuickEdit() }
        }
        .onChange(of: session.inspectorRequest) { _, request in
            guard let request, let tab = WorkbenchTab(rawValue: request.tool) else { return }
            withAnimation(.easeOut(duration: 0.14)) {
                selectedTab = tab
                dockFocus = .primary
            }
        }
        .overlay {
            if let stage = session.oneClickEditStage {
                OneClickEditProgressOverlay(stage: stage)
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.16), value: session.oneClickEditStage)
    }

    private var workbenchTabStrip: some View {
        ScrollViewReader { scrollProxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 2) {
                    ForEach(tabOrder) { tab in
                        Button {
                            withAnimation(.easeOut(duration: 0.14)) {
                                if secondaryTab == tab {
                                    dockFocus = .secondary
                                } else {
                                    selectedTab = tab
                                    dockFocus = .primary
                                }
                            }
                        } label: {
                            VStack(spacing: 5) {
                                Image(systemName: tab.icon)
                                    .font(.system(size: 14, weight: .semibold))
                                Text(tab.rawValue)
                                    .font(.system(size: 11, weight: .semibold))
                            }
                            .foregroundStyle(
                                isTabActive(tab) ? Color.yapperOrange : Color.secondary
                            )
                            .frame(width: tab == .quick ? 78 : 64, height: 52)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.studioPlain)
        .clickableCursor()
                        .opacity(draggingTab == tab ? 0.58 : 1)
                        .id(tab.id)
                        .highPriorityGesture(tabDragGesture(for: tab))
                        .onDrag {
                            let provider = NSItemProvider(object: tab.rawValue as NSString)
                            provider.suggestedName = tab.rawValue
                            return provider
                        } preview: {
                            Label(tab.rawValue, systemImage: tab.icon)
                                .font(.studioBodyStrong)
                                .padding(.horizontal, 12)
                                .frame(height: 38)
                                .background(.regularMaterial)
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                        .onDrop(
                            of: [UTType.utf8PlainText.identifier],
                            delegate: WorkbenchDropDelegate(
                                onDrop: { raw, _ in
                                    _ = reorderTab(raw, before: tab)
                                }
                            )
                        )
                    }
                }
                .padding(.horizontal, 8)
            }
            .background(Color.panelBackground)
            .onChange(of: selectedTab) { _, tab in
                withAnimation(.easeOut(duration: 0.18)) {
                    scrollProxy.scrollTo(tab.id, anchor: .center)
                }
            }
            .onChange(of: secondaryTab) { _, tab in
                guard let tab else { return }
                withAnimation(.easeOut(duration: 0.18)) {
                    scrollProxy.scrollTo(tab.id, anchor: .center)
                }
            }
        }
    }

    @ViewBuilder
    private func workbenchDock(width: CGFloat) -> some View {
        if let secondaryTab, width >= 720 {
            HSplitView {
                WorkbenchDockPane(
                    tab: selectedTab,
                    focused: dockFocus == .primary,
                    closeAction: nil
                ) {
                    workbenchContent(for: selectedTab)
                }
                .frame(minWidth: 300, idealWidth: width * 0.5)
                .onTapGesture { dockFocus = .primary }

                WorkbenchDockPane(
                    tab: secondaryTab,
                    focused: dockFocus == .secondary,
                    closeAction: closeSecondaryPane
                ) {
                    workbenchContent(for: secondaryTab)
                }
                .frame(minWidth: 300, idealWidth: width * 0.5)
                .onTapGesture { dockFocus = .secondary }
            }
        } else if let secondaryTab {
            VStack(spacing: 0) {
                HStack(spacing: 5) {
                    compactDockButton(selectedTab, focus: .primary)
                    compactDockButton(secondaryTab, focus: .secondary)
                    Spacer(minLength: 0)
                    Button(action: closeSecondaryPane) {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .bold))
                            .frame(width: 27, height: 27)
                    }
                    .buttonStyle(.studioPlain)
        .clickableCursor()
                    .help("Close secondary pane")
                }
                .padding(.horizontal, 10)
                .frame(height: 38)
                .background(Color.raisedBackground)

                workbenchContent(for: dockFocus == .secondary ? secondaryTab : selectedTab)
            }
        } else {
            workbenchContent(for: selectedTab)
        }
    }

    @ViewBuilder
    private func workbenchContent(for tab: WorkbenchTab) -> some View {
        switch tab {
        case .media:
            MediaWorkbench(session: session)
        case .quick:
            QuickEditWorkbench(session: session)
        case .transcript:
            TranscriptWorkbench(session: session, cursor: session.playbackCursor)
        case .video:
            VideoWorkbench(session: session)
        case .audio:
            AudioWorkbench(session: session)
        case .text:
            TextWorkbench(session: session)
        case .overlays:
            OverlayWorkbench(session: session)
        case .captions:
            CaptionWorkbenchView(session: session)
        case .filters:
            FiltersWorkbench(session: session)
        default:
            FeatureWorkbench(tab: tab)
        }
    }

    private func compactDockButton(_ tab: WorkbenchTab, focus: WorkbenchDockFocus) -> some View {
        Button {
            withAnimation(.easeOut(duration: 0.14)) { dockFocus = focus }
        } label: {
            Label(tab.rawValue, systemImage: tab.icon)
                .font(.studioCaptionStrong)
                .foregroundStyle(dockFocus == focus ? Color.yapperOrange : Color.secondary)
                .padding(.horizontal, 9)
                .frame(height: 28)
                .background(dockFocus == focus ? Color.studioSelectedFill : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
    }

    private func isTabActive(_ tab: WorkbenchTab) -> Bool {
        tab == selectedTab || tab == secondaryTab
    }

    private func tabDragGesture(for tab: WorkbenchTab) -> some Gesture {
        DragGesture(minimumDistance: 5, coordinateSpace: .named("workbenchDock"))
            .onChanged { value in
                draggingTab = tab
                withAnimation(.easeOut(duration: 0.1)) {
                    panelDropTargeted = value.location.y > 54
                }
            }
            .onEnded { value in
                defer {
                    draggingTab = nil
                    withAnimation(.easeOut(duration: 0.1)) {
                        panelDropTargeted = false
                    }
                }

                if value.location.y > 54 {
                    handlePanelDrop(
                        tab.rawValue,
                        at: value.location,
                        width: max(1, workbenchWidth)
                    )
                } else if let target = tabTarget(at: value.location.x) {
                    _ = reorderTab(tab.rawValue, before: target)
                }
            }
    }

    private func tabTarget(at x: CGFloat) -> WorkbenchTab? {
        var cursor: CGFloat = 8
        for tab in tabOrder {
            let width: CGFloat = tab == .quick ? 78 : 64
            if x < cursor + width { return tab }
            cursor += width + 2
        }
        return tabOrder.last
    }

    private func closeSecondaryPane() {
        withAnimation(.easeOut(duration: 0.16)) {
            secondaryTab = nil
            secondaryPaneDismissed = true
            dockFocus = .primary
        }
    }

    /// Fills the second pane as soon as the panel is wide enough to show two
    /// side by side, so the space is never wasted on one tab.
    private func openSecondaryPaneIfRoomy() {
        guard
            workbenchWidth >= Self.splitPaneWidth,
            secondaryTab == nil,
            !secondaryPaneDismissed
        else { return }
        withAnimation(.easeOut(duration: 0.18)) {
            secondaryTab = companionTab(for: selectedTab)
        }
    }

    /// The tab that pairs naturally with another: the one you reach for next.
    private func companionTab(for tab: WorkbenchTab) -> WorkbenchTab {
        switch tab {
        case .quick, .media, .filters: .transcript
        case .transcript, .captions, .audio, .text, .overlays, .video: .quick
        }
    }

    /// Brings Quick Edit forward once there is footage to work on. When a
    /// second pane is free it opens the Transcript beside it, which is the pane
    /// worth watching while a 1-Click Edit runs.
    private func focusQuickEdit() {
        if secondaryTab == .quick {
            dockFocus = .secondary
            return
        }
        if selectedTab != .quick {
            selectedTab = .quick
        }
        dockFocus = .primary
        if secondaryTab == nil, workbenchWidth >= Self.splitPaneWidth, !secondaryPaneDismissed {
            secondaryTab = .transcript
        }
    }

    private func handlePanelDrop(_ raw: String, at location: CGPoint, width: CGFloat) {
        guard let tab = WorkbenchTab(rawValue: raw) else { return }
        withAnimation(.easeOut(duration: 0.18)) {
            if location.x > width * 0.52 {
                if tab != selectedTab {
                    secondaryTab = tab
                    dockFocus = .secondary
                }
            } else {
                selectedTab = tab
                if secondaryTab == tab { secondaryTab = nil }
                dockFocus = .primary
            }
        }
    }

    private func reorderTab(_ raw: String, before target: WorkbenchTab) -> Bool {
        guard let moving = WorkbenchTab(rawValue: raw), moving != target,
              let sourceIndex = tabOrder.firstIndex(of: moving),
              let targetIndex = tabOrder.firstIndex(of: target)
        else { return false }
        withAnimation(.easeOut(duration: 0.16)) {
            tabOrder.remove(at: sourceIndex)
            let insertionIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
            tabOrder.insert(moving, at: insertionIndex)
            tabOrderRaw = tabOrder.map(\.rawValue).joined(separator: "|")
        }
        return true
    }

    private func restoreTabOrder() {
        let restored = tabOrderRaw
            .split(separator: "|")
            .compactMap { WorkbenchTab(rawValue: String($0)) }
        let unique = restored.reduce(into: [WorkbenchTab]()) { result, tab in
            if !result.contains(tab) { result.append(tab) }
        }
        tabOrder = unique + WorkbenchTab.allCases.filter { !unique.contains($0) }
    }
}

private struct WorkbenchDropDelegate: DropDelegate {
    var isTargeted: Binding<Bool>?
    let onDrop: (String, CGPoint) -> Void

    init(
        isTargeted: Binding<Bool>? = nil,
        onDrop: @escaping (String, CGPoint) -> Void
    ) {
        self.isTargeted = isTargeted
        self.onDrop = onDrop
    }

    func validateDrop(info: DropInfo) -> Bool {
        info.hasItemsConforming(to: [UTType.utf8PlainText])
    }

    func dropEntered(info: DropInfo) {
        isTargeted?.wrappedValue = true
    }

    func dropExited(info: DropInfo) {
        isTargeted?.wrappedValue = false
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }

    func performDrop(info: DropInfo) -> Bool {
        defer { isTargeted?.wrappedValue = false }
        guard let provider = info.itemProviders(for: [UTType.utf8PlainText]).first,
              let raw = provider.suggestedName
        else { return false }
        onDrop(raw, info.location)
        return true
    }
}

private struct WorkbenchDockPane<Content: View>: View {
    let tab: WorkbenchTab
    let focused: Bool
    let closeAction: (() -> Void)?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: tab.icon)
                    .foregroundStyle(focused ? Color.yapperOrange : Color.secondary)
                Text(tab.rawValue)
                    .font(.studioCaptionStrong)
                Spacer()
                if let closeAction {
                    Button(action: closeAction) {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .bold))
                            .frame(width: 26, height: 26)
                    }
                    .buttonStyle(.studioPlain)
        .clickableCursor()
                    .help("Close secondary pane")
                }
            }
            .padding(.horizontal, 11)
            .frame(height: 36)
            .background(Color.raisedBackground)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(Color.studioLine)
                    .frame(height: 1)
            }

            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

private struct WorkbenchDropGuide: View {
    var body: some View {
        HStack(spacing: 8) {
            dropZone("Open here", icon: "rectangle")
            dropZone("Open beside", icon: "rectangle.split.2x1")
        }
        .padding(12)
        .background(Color.panelBackground.opacity(0.82))
    }

    private func dropZone(_ title: String, icon: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .medium))
            Text(title)
                .font(.studioBodyStrong)
        }
        .foregroundStyle(Color.yapperOrange)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.yapperOrange.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.yapperOrange.opacity(0.65), style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
        )
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

/// The 1-Click Edit stage checklist.
///
/// Deliberately not a modal scrim: the whole point of watching the run is
/// seeing the tabs fill in behind it — the transcript appearing the moment the
/// transcribe step lands, the timeline shedding clips as the cuts are made. It
/// sits in the corner and never takes a click.
private struct OneClickEditProgressOverlay: View {
    let stage: OneClickEditStage

    var body: some View {
        VStack {
            Spacer(minLength: 0)

            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 10) {
                    Image(systemName: "wand.and.stars")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.yapperOrange)
                        .frame(width: 32, height: 32)
                        .background(Color.yapperOrange.opacity(0.14))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Editing your video")
                            .font(.studioBodyStrong)
                        Text("Building a clean, continuous native timeline")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                    }
                }

                VStack(alignment: .leading, spacing: 13) {
                    ForEach(OneClickEditStage.allCases, id: \.rawValue) { item in
                        HStack(spacing: 10) {
                            Group {
                                if item.rawValue < stage.rawValue {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(Color.yapperOrange)
                                } else if item == stage {
                                    ProgressView()
                                        .controlSize(.small)
                                        .tint(Color.yapperOrange)
                                } else {
                                    Circle()
                                        .fill(Color.secondary.opacity(0.32))
                                        .frame(width: 5, height: 5)
                                }
                            }
                            .font(.system(size: 11, weight: .bold))
                            .frame(width: 18, height: 18)

                            if item == stage {
                                ShimmeringStatusText(text: item.title)
                            } else {
                                Text(item.title)
                                    .font(.studioCaptionStrong)
                                    .foregroundStyle(
                                        item.rawValue < stage.rawValue
                                            ? Color.primary.opacity(0.72)
                                            : Color.secondary.opacity(0.52)
                                    )
                            }
                        }
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: 320, alignment: .leading)
            .background(.ultraThinMaterial)
            .background(Color.panelBackground.opacity(0.94))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.studioLine, lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.34), radius: 28, y: 12)
            .padding(14)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .allowsHitTesting(false)
    }
}

private struct ShimmeringStatusText: View {
    let text: String

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let elapsed = context.date.timeIntervalSinceReferenceDate
            let phase = elapsed.truncatingRemainder(dividingBy: 1.5) / 1.5
            Text(text)
                .font(.studioCaptionStrong)
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Color.secondary.opacity(0.72),
                            Color.cyan,
                            Color.secondary.opacity(0.72),
                        ],
                        startPoint: UnitPoint(x: phase * 2 - 1, y: 0.5),
                        endPoint: UnitPoint(x: phase * 2, y: 0.5)
                    )
                )
        }
    }
}

private struct QuickEditWorkbench: View {
    @ObservedObject var session: EditorSession

    /// Hidden captions are still there, so the action offers them back rather
    /// than offering to build them again.
    private var captionActionTitle: String {
        if session.captionsVisible { return "Hide Captions" }
        return session.hasCaptions ? "Show Captions" : "Add Captions"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Quick Edit")
                .font(.system(size: 15, weight: .bold))
            Text("AI edits will operate on this native timeline without rebuilding the player between clips.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 10) {
                QuickAction(
                    title: session.project.hasTimelineTranscript ? "Transcribe Again" : "Transcribe",
                    detail: "Accurate timed words",
                    icon: "doc.text",
                    busy: session.isAIEditing
                ) {
                    Task { await session.transcribeProject() }
                }
                QuickAction(
                    title: session.isAIEditing ? "Editing…" : "1-Click Edit + Captions",
                    detail: "Retakes, pauses + captions",
                    icon: "wand.and.stars",
                    busy: session.isAIEditing
                ) {
                    Task { await session.runOneClickEdit() }
                }
                QuickAction(
                    title: captionActionTitle,
                    detail: session.captionsVisible
                        ? "Keeps every card for later"
                        : (session.hasCaptions ? "Bring back your cards" : "Generate from transcript"),
                    icon: "captions.bubble",
                    busy: session.isAIEditing
                ) {
                    Task { await session.toggleCaptions() }
                }
                QuickAction(
                    title: "Text Hook",
                    detail: "Add at the playhead",
                    icon: "textformat",
                    disabled: session.project.clips.isEmpty
                ) { session.addTextLayer(asHook: true) }
            }
            .disabled(session.project.clips.isEmpty)

            if session.isAIEditing {
                ProgressView(value: session.aiProgress)
                    .tint(Color.yapperOrange)
                Text(session.statusMessage)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .padding(16)
        .inspectorPane(maxWidth: 620)
    }
}

private struct TextWorkbench: View {
    @ObservedObject var session: EditorSession

    private var layers: [ProjectTextLayer] { session.project.textLayers ?? [] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Text")
                            .font(.studioSectionTitle)
                        Text("Positioned layers that stay attached to the timeline")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 12)
                    HStack(spacing: 8) {
                        Button {
                            session.addTextLayer()
                        } label: {
                            Label("Text", systemImage: "plus")
                        }
                        .buttonStyle(EditorSecondaryButtonStyle())

                        Button {
                            session.addTextLayer(asHook: true)
                        } label: {
                            Label("Hook", systemImage: "wand.and.stars")
                        }
                        .buttonStyle(EditorPrimaryButtonStyle())
                    }
                    .disabled(session.project.clips.isEmpty)
                }

                if layers.isEmpty {
                    VStack(alignment: .leading, spacing: 9) {
                        Label("No text layers", systemImage: "textformat")
                            .font(.studioBodyStrong)
                        Text("Add regular text anywhere on the canvas, or start with a top-line hook built for short-form video.")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(14)
                    .frame(maxWidth: 480, alignment: .leading)
                    .background(Color.raisedBackground)
                    .overlay {
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.studioLine, lineWidth: 1)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("LAYERS")
                            .font(.studioCaptionStrong)
                            .foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 7) {
                                ForEach(layers) { layer in
                                    TextLayerChip(
                                        layer: layer,
                                        selected: session.selectedTextLayerID == layer.id
                                    ) {
                                        session.selectTextLayer(layer.id)
                                        session.scrub(to: layer.timelineStart)
                                        session.finishScrubbing(at: layer.timelineStart)
                                    }
                                }
                            }
                        }
                    }

                    if let layer = session.selectedTextLayer {
                        Divider()
                        TextLayerInspectorView(session: session, layer: layer)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: 680, alignment: .leading)
        }
        .inspectorPane(maxWidth: 680)
    }

}

private struct TextLayerChip: View {
    let layer: ProjectTextLayer
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 3) {
                Text(layer.text.isEmpty ? "Empty text" : layer.text)
                    .font(.studioBodyStrong)
                    .lineLimit(1)
                Text("\(formatTime(layer.timelineStart)) · \(String(format: "%.1fs", layer.duration))")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10)
            .frame(width: 150, height: 48, alignment: .leading)
            .background(selected ? Color.studioSelectedFill : Color.raisedBackground)
            .overlay {
                RoundedRectangle(cornerRadius: 7)
                    .stroke(selected ? Color.yapperOrange.opacity(0.8) : Color.studioLine, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
    }
}

private struct ChoiceButton: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.studioCaptionStrong)
                .padding(.horizontal, 10)
                .frame(height: 31)
                .background(selected ? Color.studioSelectedFill : Color.studioFaintFill)
                .overlay {
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(selected ? Color.yapperOrange.opacity(0.78) : Color.studioLine, lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
    }
}

private struct QuickAction: View {
    let title: String
    let detail: String
    let icon: String
    var busy = false
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 9) {
                if busy {
                    ProgressView().controlSize(.small).tint(Color.yapperOrange)
                } else {
                    Image(systemName: icon)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color.yapperOrange)
                }
                Text(title)
                    .font(.studioBodyStrong)
                Text(detail)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: 290, minHeight: 78, alignment: .leading)
            .padding(12)
            .background(Color.raisedBackground)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.studioLine, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .disabled(disabled || busy)
        .opacity(disabled ? 0.48 : 1)
    }
}

/// The spoken words, to read and to edit by.
///
/// The transcript does not chase the playhead. The word being spoken is marked
/// where it is, and the scroller belongs entirely to whoever is holding it:
/// scrolling back to find a line while the video plays was a fight with an
/// animation that kept pulling the page somewhere else.
private struct TranscriptWorkbench: View {
    private static let selectionCoordinateSpace = "transcriptSelectionCanvas"
    /// How finely the transcript answers a resize. A step under a word wide
    /// costs at most a word of slack at the right edge, which is a ragged edge
    /// among ragged edges, and it buys a divider that moves without stuttering.
    private static let wrapStep = 16.0

    @ObservedObject var session: EditorSession
    /// The spoken word is taken from the cursor, which only publishes when the
    /// playhead crosses into the next word. Deriving it from the raw time here
    /// re-laid-out every token on every frame of playback.
    @ObservedObject var cursor: PlaybackCursor
    @State private var selection = TranscriptWordSelection()
    @State private var isApplyingSelection = false
    /// Where the flow sits inside the marquee's space, and how wide it is. Two
    /// numbers for the whole transcript, in place of a reader behind every word.
    @State private var flowOrigin: CGPoint = .zero
    @State private var flowWidth: Double = 480
    /// Word positions, worked out once when a marquee starts rather than on
    /// every frame of the drag.
    @State private var marqueeWordFrames: [UUID: CGRect] = [:]
    @State private var marqueeStart: CGPoint?
    @State private var marqueeCurrent: CGPoint?
    @State private var marqueeBaseWordIDs: Set<UUID> = []
    @State private var marqueeMode: TranscriptWordSelection.MarqueeMode = .replace

    private var words: [TranscriptWord] { session.transcriptFlowCache.words }
    private var selectedWords: [TranscriptWord] {
        words.filter { selection.wordIDs.contains($0.id) }
    }
    private var selectedKeptWords: [TranscriptWord] {
        selectedWords.filter { session.project.isWordKept($0) }
    }
    private var selectedDeletedWords: [TranscriptWord] {
        selectedWords.filter { !session.project.isWordKept($0) }
    }
    /// Both come from the session's cache, which rebuilds them only when the
    /// transcript or the cuts change.
    private var flowTokens: [TranscriptFlowToken] { session.transcriptFlowCache.tokens }

    /// Both come from the cache: measured once per transcript, wrapped once per
    /// width, rather than on every body of this panel. A drag anywhere in the
    /// editor re-lays out this pane, and it was paying for a full pass over
    /// every token each time.
    private var tokenWidths: [Double] { session.transcriptFlowCache.tokenWidths }

    private var transcriptLines: [TranscriptLine] {
        session.transcriptFlowCache.lines(forWidth: flowWidth)
    }


    @ViewBuilder
    private func tokenView(at index: Int, playbackWordID: UUID?) -> some View {
        if index < flowTokens.count {
            switch flowTokens[index] {
            case let .word(word):
                transcriptWordButton(word, playbackWordID: playbackWordID)
            case let .pause(pause):
                transcriptPauseButton(pause)
            }
        }
    }

    /// Where every word sits, for a marquee to test against. Worked out from
    /// the same arithmetic that wrapped them, so it needs no views at all and
    /// knows about the words that are scrolled out of sight too.
    private func wordFrameTable() -> [UUID: CGRect] {
        let widths = tokenWidths
        let lines = transcriptLines
        var frames: [UUID: CGRect] = [:]
        for (index, token) in flowTokens.enumerated() {
            guard case let .word(word) = token else { continue }
            guard let frame = TranscriptLineBreaker.frame(
                ofToken: index,
                in: lines,
                widths: widths,
                lineHeight: TranscriptFlow.lineHeight,
                lineSpacing: TranscriptFlow.lineSpacing
            ) else { continue }
            frames[word.id] = frame.offsetBy(dx: flowOrigin.x, dy: flowOrigin.y)
        }
        return frames
    }

    var body: some View {
        let playbackWordID = cursor.transcriptWordID
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Transcript").font(.studioSectionTitle)
                    Text(words.isEmpty ? "Transcribe to edit by words" : "\(words.count) timed words")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button(words.isEmpty ? "Transcribe" : "Transcribe Again") {
                    Task { await session.transcribeProject() }
                }
                .buttonStyle(EditorSecondaryButtonStyle())
                .disabled(session.isAIEditing || session.project.clips.isEmpty)
            }

            if !words.isEmpty {
                Text("Click to seek  ·  drag a box to multi-select  ·  Shift/⌘ adds  ·  click a […] pause to remove or restore it")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }

            if session.isAIEditing {
                ProgressView(value: session.aiProgress).tint(Color.yapperOrange)
                Text(session.statusMessage).font(.studioCaption).foregroundStyle(.secondary)
            }

            if words.isEmpty {
                ContentUnavailableView(
                    "No transcript yet",
                    systemImage: "doc.text.magnifyingglass",
                    description: Text("The native transcriber sends clean PCM chunks to the same accurate service as the web editor.")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // Measured here rather than reported up from a preference. The
                // wrapping is arithmetic over this width, so it has to be the
                // width the panel has now: read from a layer behind the
                // scroller, the transcript went on wrapping to the width the
                // panel used to have and left the rest of the pane empty.
                GeometryReader { geometry in
                    ZStack(alignment: .bottom) {
                        ScrollView {
                            // Rows, not a flow. The wrapping is worked out from
                            // token widths before any view exists, which lets
                            // the rows be lazy: a transcript of any length only
                            // builds the lines you can see. The hand belongs to
                            // the whole thing, so it is one cursor region here
                            // rather than one per word.
                            LazyVStack(alignment: .leading, spacing: TranscriptFlow.lineSpacing) {
                                ForEach(transcriptLines) { line in
                                    HStack(spacing: TranscriptFlow.tokenSpacing) {
                                        ForEach(line.tokens, id: \.self) { index in
                                            tokenView(at: index, playbackWordID: playbackWordID)
                                                .frame(
                                                    width: tokenWidths[index],
                                                    alignment: .leading
                                                )
                                        }
                                    }
                                    .frame(height: TranscriptFlow.lineHeight, alignment: .leading)
                                    .id(line.id)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background {
                                GeometryReader { geometry in
                                    Color.clear.preference(
                                        key: TranscriptFlowOriginKey.self,
                                        value: geometry.frame(in: .named(Self.selectionCoordinateSpace)).origin
                                    )
                                }
                            }
                            .cursor(.pointingHand)
                            .padding(.bottom, selection.wordIDs.isEmpty ? 0 : 58)
                        }

                        if let marqueeRectangle {
                            Rectangle()
                                .fill(Color.cyan.opacity(0.12))
                                .overlay {
                                    Rectangle()
                                        .stroke(Color.cyan.opacity(0.9), lineWidth: 1)
                                }
                                .frame(width: marqueeRectangle.width, height: marqueeRectangle.height)
                                .position(x: marqueeRectangle.midX, y: marqueeRectangle.midY)
                                .allowsHitTesting(false)
                        }

                        if !selection.wordIDs.isEmpty {
                            selectionBar
                        }
                    }
                    .coordinateSpace(name: Self.selectionCoordinateSpace)
                    .onPreferenceChange(TranscriptFlowOriginKey.self) { origin in
                        flowOrigin = origin
                    }
                    .onChange(of: geometry.size.width, initial: true) { _, width in
                        // A floor, so a transient zero during a layout pass can
                        // never wrap the transcript one word to a line.
                        guard width > 80 else { return }
                        // Held in steps, not to the point. Dragging the divider
                        // walks the width through every value between the two
                        // ends, and re-wrapping a few hundred words on each of
                        // them is what made the drag stutter. In steps, most
                        // frames of a drag change nothing here at all, and the
                        // ones that do are a wrap the eye was expecting anyway.
                        let stepped = (width / Self.wrapStep).rounded(.down) * Self.wrapStep
                        guard stepped != flowWidth else { return }
                        flowWidth = stepped
                    }
                    .highPriorityGesture(marqueeGesture)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var selectionBar: some View {
        HStack(spacing: 6) {
            Text("\(selection.wordIDs.count) selected")
                .font(.studioCaptionStrong)
                .padding(.horizontal, 6)

            if !selectedDeletedWords.isEmpty {
                Button {
                    applyRestore()
                } label: {
                    Label("Restore \(selectedDeletedWords.count)", systemImage: "arrow.uturn.backward")
                }
                .buttonStyle(TranscriptActionButtonStyle(tint: .green))
            }

            if !selectedKeptWords.isEmpty {
                Button {
                    applyDelete()
                } label: {
                    Label("Delete \(selectedKeptWords.count)", systemImage: "trash")
                }
                .buttonStyle(TranscriptActionButtonStyle(tint: .red))
            }

            Button("Clear") {
                selection.clear()
            }
            .buttonStyle(TranscriptActionButtonStyle(tint: .secondary))
        }
        .disabled(isApplyingSelection)
        .padding(6)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .stroke(Color.studioLine, lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.24), radius: 12, y: 4)
        .padding(.bottom, 10)
    }

    private var marqueeRectangle: CGRect? {
        guard let marqueeStart, let marqueeCurrent else { return nil }
        return Self.rectangle(from: marqueeStart, to: marqueeCurrent)
    }

    private func transcriptWordButton(_ word: TranscriptWord, playbackWordID: UUID?) -> some View {
        let kept = session.project.isWordKept(word)
        let active = playbackWordID == word.id
        return Button {
            select(word, kept: kept)
        } label: {
            Text(word.text)
                .font(.system(size: 14, weight: active ? .bold : kept ? .medium : .regular))
                .foregroundStyle(wordForeground(wordID: word.id, kept: kept))
                .strikethrough(!kept, color: selection.wordIDs.contains(word.id) ? Color.white : Color.secondary)
                .underline(active && !selection.wordIDs.contains(word.id), color: Color.cyan)
                .padding(.horizontal, 3)
                .padding(.vertical, 3)
                .background(wordBackground(wordID: word.id, kept: kept, active: active))
                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
        }
        .buttonStyle(.plain)
        // Clicking a word must not leave it holding the keyboard: a focused
        // button fires on Space, so the next Space seeked to the word again
        // instead of starting playback.
        .focusable(false)
        .highPriorityGesture(marqueeGesture)
        .help(kept ? "Select and seek to \(word.text)" : "Select deleted word to restore")
        .id(word.id)
    }

    private func transcriptPauseButton(_ pause: TranscriptPause) -> some View {
        let kept = session.project.isSourceRangeKept(
            mediaID: pause.mediaID,
            start: pause.start,
            end: pause.end
        )
        return Button {
            selection.clear()
            Task {
                if kept {
                    await session.deleteTranscriptPause(
                        mediaID: pause.mediaID,
                        start: pause.start,
                        end: pause.end
                    )
                } else {
                    await session.restoreTranscriptPause(
                        mediaID: pause.mediaID,
                        start: pause.start,
                        end: pause.end
                    )
                }
            }
        } label: {
            Text(pause.label)
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(kept ? Color.secondary : Color.secondary.opacity(0.42))
                .strikethrough(!kept, color: Color.secondary.opacity(0.55))
                .padding(.horizontal, 5)
                .padding(.vertical, 3)
                .background(kept ? Color.primary.opacity(0.07) : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .stroke(kept ? Color.studioLine : Color.clear, lineWidth: 1)
                }
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .help(kept ? "Delete this \(pause.duration.formatted(.number.precision(.fractionLength(1)))) second pause" : "Restore this removed pause")
    }

    private var marqueeGesture: some Gesture {
        DragGesture(minimumDistance: 4, coordinateSpace: .named(Self.selectionCoordinateSpace))
            .onChanged { value in
                if marqueeStart == nil {
                    marqueeStart = value.startLocation
                    marqueeWordFrames = wordFrameTable()
                    marqueeBaseWordIDs = selection.wordIDs
                    let modifiers = NSApp.currentEvent?.modifierFlags ?? []
                    if modifiers.contains(.command) || modifiers.contains(.control) {
                        marqueeMode = .toggle
                    } else if modifiers.contains(.shift) {
                        marqueeMode = .add
                    } else {
                        marqueeMode = .replace
                    }
                }
                marqueeCurrent = value.location
                guard let marqueeRectangle else { return }
                selection.selectMarquee(
                    marqueeRectangle,
                    wordFrames: marqueeWordFrames,
                    orderedWordIDs: words.map(\.id),
                    baseWordIDs: marqueeBaseWordIDs,
                    mode: marqueeMode
                )
            }
            .onEnded { _ in
                marqueeStart = nil
                marqueeCurrent = nil
                marqueeBaseWordIDs.removeAll()
                marqueeWordFrames.removeAll()
                marqueeMode = .replace
            }
    }

    private static func rectangle(from start: CGPoint, to end: CGPoint) -> CGRect {
        CGRect(
            x: min(start.x, end.x),
            y: min(start.y, end.y),
            width: abs(end.x - start.x),
            height: abs(end.y - start.y)
        )
    }

    private func select(_ word: TranscriptWord, kept: Bool) {
        let modifiers = NSApp.currentEvent?.modifierFlags ?? []
        selection.select(
            word.id,
            orderedWordIDs: words.map(\.id),
            extendingRange: modifiers.contains(.shift),
            toggling: modifiers.contains(.command) || modifiers.contains(.control)
        )
        if kept && !modifiers.contains(.shift) && !modifiers.contains(.command) && !modifiers.contains(.control) {
            session.seekToTranscriptWord(word)
        }
    }

    private func applyDelete() {
        let words = selectedKeptWords
        guard !words.isEmpty else { return }
        isApplyingSelection = true
        Task {
            await session.deleteTranscriptWords(words)
            selection.clear()
            isApplyingSelection = false
        }
    }

    private func applyRestore() {
        let words = selectedDeletedWords
        guard !words.isEmpty else { return }
        isApplyingSelection = true
        Task {
            await session.restoreTranscriptWords(words)
            selection.clear()
            isApplyingSelection = false
        }
    }

    private func wordForeground(wordID: UUID, kept: Bool) -> Color {
        if selection.wordIDs.contains(wordID) { return .white }
        return kept ? .primary : .secondary.opacity(0.58)
    }

    private func wordBackground(wordID: UUID, kept: Bool, active: Bool) -> Color {
        if selection.wordIDs.contains(wordID) {
            return kept ? Color.red.opacity(0.72) : Color.green.opacity(0.68)
        }
        if active { return Color.cyan.opacity(0.20) }
        return Color.clear
    }
}

private struct TranscriptActionButtonStyle: ButtonStyle {
    let tint: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.studioCaptionStrong)
            .foregroundStyle(tint == .secondary ? Color.primary : Color.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(tint.opacity(tint == .secondary ? 0.12 : configuration.isPressed ? 0.66 : 0.82))
            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            .contentShape(Rectangle())
    }
}

private func formatTranscriptTime(_ seconds: Double) -> String {
    let safe = max(0, seconds)
    return String(format: "%d:%05.2f", Int(safe) / 60, safe.truncatingRemainder(dividingBy: 60))
}

private struct AudioWorkbench: View {
    @ObservedObject var session: EditorSession

    private let columns = [
        GridItem(.adaptive(minimum: 218, maximum: 260), spacing: 8, alignment: .top),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 16) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Audio")
                            .font(.studioSectionTitle)
                        Text("Sound effects and imported audio on their own track")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 8)
                    Button {
                        ImportPanels.openAudio(for: session)
                    } label: {
                        Label("Import audio", systemImage: "square.and.arrow.down")
                    }
                    .buttonStyle(EditorSecondaryButtonStyle())
                    .disabled(session.project.clips.isEmpty)
                }

                if let selected = session.selectedAudioLayer {
                    selectedLayerEditor(selected)
                    Divider()
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("SOUND EFFECTS")
                        .font(.studioCaptionStrong)
                        .foregroundStyle(.secondary)
                    Text("Preview first, then place one at the playhead.")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                }

                // Shelved by what the effect is for, which is how anyone looks
                // for one: nobody hunts a library this size by name.
                ForEach(SoundEffectCategory.allCases) { category in
                    let effects = SoundEffectDescriptor.library(in: category)
                    if !effects.isEmpty {
                        VStack(alignment: .leading, spacing: 7) {
                            Label(category.title, systemImage: category.icon)
                                .font(.studioCaptionStrong)
                                .foregroundStyle(.secondary)

                            LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
                                ForEach(effects) { effect in
                                    SoundEffectCard(
                                        effect: effect,
                                        disabled: session.project.clips.isEmpty,
                                        isPlaying: session.previewingSoundID == effect.id
                                    ) {
                                        if session.previewingSoundID == effect.id {
                                            session.stopSoundPreview()
                                        } else {
                                            Task { await session.previewSoundEffect(effect) }
                                        }
                                    } add: {
                                        Task { await session.addSoundEffect(effect) }
                                    }
                                }
                            }
                        }
                        .frame(maxWidth: 528, alignment: .leading)
                    }
                }

                if let layers = session.project.audioLayers, !layers.isEmpty {
                    Divider()
                    VStack(alignment: .leading, spacing: 8) {
                        Text("IN THIS PROJECT")
                            .font(.studioCaptionStrong)
                            .foregroundStyle(.secondary)
                        ForEach(layers) { layer in
                            Button {
                                session.selectAudioLayer(layer.id)
                                session.scrub(to: layer.timelineStart)
                                session.finishScrubbing(at: layer.timelineStart)
                            } label: {
                                HStack(spacing: 9) {
                                    Image(systemName: layer.builtInID == nil ? "waveform" : "sparkles")
                                        .foregroundStyle(Color.yapperOrange)
                                        .frame(width: 18)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(layer.name).font(.studioBodyStrong)
                                        Text("\(formatTimePrecise(layer.timelineStart)) · \(String(format: "%.1fs", layer.duration))")
                                            .font(.studioCaption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .padding(.horizontal, 10)
                                .frame(width: 260, height: 48, alignment: .leading)
                                .background(session.selectedAudioLayerID == layer.id ? Color.studioSelectedFill : Color.raisedBackground)
                                .overlay {
                                    RoundedRectangle(cornerRadius: 7)
                                        .stroke(session.selectedAudioLayerID == layer.id ? Color.yapperOrange.opacity(0.75) : Color.studioLine, lineWidth: 1)
                                }
                                .clipShape(RoundedRectangle(cornerRadius: 7))
                            }
                            .buttonStyle(.studioPlain)
        .clickableCursor()
                        }
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: 620, alignment: .leading)
        }
        .inspectorPane(maxWidth: 660)
    }

    private func selectedLayerEditor(_ layer: ProjectAudioLayer) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "waveform.circle")
                    .font(.system(size: 19, weight: .medium))
                    .foregroundStyle(Color.yapperOrange)
                VStack(alignment: .leading, spacing: 2) {
                    Text(layer.name).font(.studioBodyStrong)
                    Text("Selected audio · starts at \(formatTimePrecise(layer.timelineStart))")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                // Changing your mind about which click it is should not mean
                // finding the moment again: see EditorSession+SoundSwap.
                Menu {
                    SoundSwapMenu(session: session, layer: layer)
                } label: {
                    Label("Replace", systemImage: "arrow.2.squarepath")
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                .help("Swap this for another sound, keeping its place")

                Button(role: .destructive) {
                    Task { await session.deleteSelectedAudioLayer() }
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                .buttonStyle(EditorSecondaryButtonStyle())
            }

            HStack(spacing: 9) {
                Text("Volume")
                    .font(.studioCaptionStrong)
                    .foregroundStyle(.secondary)
                VolumeSlider(
                    volume: session.volume(for: layer),
                    onChange: { session.previewVolume($0, for: layer.id) },
                    onCommit: { session.commitLayerVolume() }
                )
            }
        }
        .padding(12)
        .frame(maxWidth: 540, alignment: .leading)
        .background(Color.raisedBackground)
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.yapperOrange.opacity(0.35), lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

private struct SoundEffectCard: View {
    let effect: SoundEffectDescriptor
    let disabled: Bool
    /// True while this is the effect being heard, so the play becomes a stop.
    /// A ten-second typing loop started by accident had no way out but waiting.
    let isPlaying: Bool
    let preview: () -> Void
    let add: () -> Void

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: effect.icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.yapperOrange)
                .frame(width: 28, height: 28)
                .background(Color.yapperOrange.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 6))

            VStack(alignment: .leading, spacing: 2) {
                Text(effect.name)
                    .font(.studioBodyStrong)
                    .lineLimit(1)
                Text(effect.detail)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Button(action: preview) {
                Image(systemName: isPlaying ? "stop.fill" : "play.fill")
                    .font(.system(size: 10, weight: .bold))
                    .frame(width: 27, height: 27)
            }
            .buttonStyle(.studioPlain)
        .clickableCursor()
            .foregroundStyle(isPlaying ? Color.yapperOrange : Color.primary)
            .background(isPlaying ? Color.yapperOrange.opacity(0.14) : Color.studioFaintFill)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .help(isPlaying ? "Stop" : "Preview \(effect.name)")

            Button(action: add) {
                Image(systemName: "plus")
                    .font(.system(size: 11, weight: .bold))
                    .frame(width: 27, height: 27)
            }
            .buttonStyle(.studioPlain)
        .clickableCursor()
            .foregroundStyle(disabled ? Color.secondary : Color.white)
            .background(disabled ? Color.studioFaintFill : Color.yapperOrange)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .disabled(disabled)
            .help("Add \(effect.name) at playhead")
        }
        .padding(.horizontal, 9)
        .frame(width: 260, height: 54, alignment: .leading)
        .background(Color.raisedBackground)
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.studioLine, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}


private struct FeatureWorkbench: View {
    let tab: WorkbenchTab

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: tab.icon)
                    .font(.system(size: 21, weight: .medium))
                    .foregroundStyle(Color.yapperOrange)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 4) {
                    Text(tab.rawValue)
                        .font(.studioSectionTitle)
                    Text(featureDescription)
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Text("Controls will appear here when this tool is selected. They remain attached to the native timeline and never replace your edit.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
                .padding(14)
                .frame(maxWidth: 440, alignment: .leading)
                .background(Color.raisedBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.studioLine, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .padding(16)
        .inspectorPane(maxWidth: 560)
    }

    private var featureDescription: String {
        switch tab {
        case .audio:
            "Upload audio, add sound effects, and adjust track volume."
        case .text:
            "Add freely positioned text layers and text hooks."
        case .captions:
            "Generate and style spoken captions without blocking the preview."
        case .filters:
            "Apply visual adjustments to selected clips or the full timeline."
        default:
            "Edit this part of the project from a focused properties pane."
        }
    }
}

func formatTime(_ seconds: Double) -> String {
    guard seconds.isFinite else { return "0:00" }
    let total = max(0, Int(seconds.rounded()))
    return String(format: "%d:%02d", total / 60, total % 60)
}
