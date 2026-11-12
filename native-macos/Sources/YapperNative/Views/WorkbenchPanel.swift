import Foundation
import SwiftUI
import UniformTypeIdentifiers

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
                OneClickEditProgressOverlay(stage: stage, pace: session.oneClickEditPace)
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.16), value: session.oneClickEditStage)
    }

    /// Two panes side by side, or one. Only offered when the panel is wide
    /// enough to hold both.
    @ViewBuilder
    private var splitPaneToggle: some View {
        if workbenchWidth >= Self.splitPaneWidth {
            let isSplit = secondaryTab != nil
            Button {
                if isSplit {
                    closeSecondaryPane()
                } else {
                    withAnimation(.easeOut(duration: 0.18)) {
                        secondaryPaneDismissed = false
                        secondaryTab = companionTab(for: selectedTab)
                    }
                }
            } label: {
                StudioGlyph(.splitPane, size: 16)
                    .foregroundStyle(isSplit ? Color.primary : Color.studioTextMuted)
                    .frame(width: 28, height: 28)
                    .background(
                        isSplit ? Color.studioSelectedFill : Color.clear,
                        in: RoundedRectangle(cornerRadius: StudioRadius.control, style: .continuous)
                    )
                    .contentShape(Rectangle())
            }
            .buttonStyle(.studioPlain)
            .help(isSplit ? "Show one pane" : "Show two panes side by side")
            .accessibilityLabel("Two panes")
            .accessibilityAddTraits(isSplit ? .isSelected : [])
            .padding(.horizontal, 10)
            .frame(maxHeight: .infinity)
            .background(Color.panelBackground)
        }
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
                            WorkbenchTabLabel(tab: tab, isActive: isTabActive(tab))
                        }
                        .buttonStyle(.studioPlain)
                        .help(tab.purpose)
                        .opacity(draggingTab == tab ? 0.58 : 1)
                        .id(tab.id)
                        .highPriorityGesture(tabDragGesture(for: tab))
                        .onDrag {
                            let provider = NSItemProvider(object: tab.rawValue as NSString)
                            provider.suggestedName = tab.rawValue
                            return provider
                        } preview: {
                            HStack(spacing: 7) {
                                StudioGlyph(tab.glyph, size: 16)
                                Text(tab.rawValue).font(.studioBodyStrong)
                            }
                            .padding(.horizontal, 12)
                            .frame(height: 38)
                            .background(.regularMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: StudioRadius.field, style: .continuous))
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
            .safeAreaInset(edge: .trailing, spacing: 0) { splitPaneToggle }
            .frame(height: WorkbenchTabLabel.height + 8)
            .background(Color.panelBackground)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Color.studioLine).frame(height: 1)
            }
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

    /// Two panes when there is room, otherwise the one in focus. A pane has
    /// no title bar of its own: the highlighted tab above and the heading
    /// inside already say what it is, and a third label said it again.
    @ViewBuilder
    private func workbenchDock(width: CGFloat) -> some View {
        if let secondaryTab, width >= Self.splitPaneWidth {
            HSplitView {
                workbenchContent(for: selectedTab)
                    .frame(minWidth: 300, idealWidth: width * 0.5, maxHeight: .infinity)
                    .onTapGesture { dockFocus = .primary }
                workbenchContent(for: secondaryTab)
                    .frame(minWidth: 300, idealWidth: width * 0.5, maxHeight: .infinity)
                    .onTapGesture { dockFocus = .secondary }
            }
        } else if let secondaryTab, dockFocus == .secondary {
            workbenchContent(for: secondaryTab)
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
            TranscriptWorkbench(
                session: session,
                cursor: session.playbackCursor,
                seekReveal: session.timelineSeekReveal
            )
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

    /// The tabs whose panes are on screen: both in a split, otherwise only
    /// the one in focus.
    private func isTabActive(_ tab: WorkbenchTab) -> Bool {
        if workbenchWidth >= Self.splitPaneWidth {
            return tab == selectedTab || tab == secondaryTab
        }
        return tab == (dockFocus == .secondary ? secondaryTab ?? selectedTab : selectedTab)
    }

    private func tabDragGesture(for tab: WorkbenchTab) -> some Gesture {
        DragGesture(minimumDistance: 5, coordinateSpace: .named("workbenchDock"))
            .onChanged { value in
                draggingTab = tab
                withAnimation(.easeOut(duration: 0.1)) {
                    panelDropTargeted = value.location.y > WorkbenchTabLabel.height + 8
                }
            }
            .onEnded { value in
                defer {
                    draggingTab = nil
                    withAnimation(.easeOut(duration: 0.1)) {
                        panelDropTargeted = false
                    }
                }

                if value.location.y > WorkbenchTabLabel.height + 8 {
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
            let width = tab.stripWidth
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
        .foregroundStyle(Color.studioAccent)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.studioAccent.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.studioAccent.opacity(0.65), style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
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
    let pace: OneClickEditPace

    var body: some View {
        VStack {
            Spacer(minLength: 0)

            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 10) {
                    Image(systemName: "wand.and.stars")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.studioAccent)
                        .frame(width: 32, height: 32)
                        .background(Color.studioAccent.opacity(0.14))
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
                                        .foregroundStyle(Color.studioAccent)
                                } else if item == stage {
                                    ProgressView()
                                        .controlSize(.small)
                                        .tint(Color.studioAccent)
                                } else {
                                    Circle()
                                        .fill(Color.secondary.opacity(0.32))
                                        .frame(width: 5, height: 5)
                                }
                            }
                            .font(.system(size: 11, weight: .bold))
                            .frame(width: 18, height: 18)

                            if item == stage {
                                VStack(alignment: .leading, spacing: 6) {
                                    ShimmeringStatusText(text: item.title)
                                    StageProgressBar(stage: stage, pace: pace)
                                }
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
            Text("Choose an edit to remove pauses, tighten your take, or add captions. Your original media is kept.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 10) {
                QuickAction(
                    title: session.project.hasTimelineTranscript ? "Transcribe Again" : "Transcribe",
                    detail: "Accurate timed words",
                    icon: "doc.text",
                    busy: session.isBusy
                ) {
                    session.startTranscription()
                }
                QuickAction(
                    title: session.isAIEditing ? "Editing…" : "1-Click Edit + Captions",
                    detail: "Retakes, pauses + captions",
                    icon: "wand.and.stars",
                    busy: session.isBusy
                ) {
                    Task { await session.runOneClickEdit() }
                }
                QuickAction(
                    title: captionActionTitle,
                    detail: session.captionsVisible
                        ? "Keeps every card for later"
                        : (session.hasCaptions ? "Bring back your cards" : "Generate from transcript"),
                    icon: "captions.bubble",
                    busy: session.isBusy,
                    disabled: !session.appActions.availability(.captionVisibility, in: session).isAvailable
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
            .disabled(session.project.clips.isEmpty || session.isBusy)

            if session.isAIEditing {
                ProgressView(value: session.aiProgress)
                    .tint(Color.studioAccent)
                Text(session.statusMessage)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                if session.canCancelCurrentOperation,
                   let operation = session.activeOperation?.operation {
                    Button(operation.cancelLabel) { session.cancelCurrentOperation() }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                }
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
                WorkbenchPaneHeader(
                    title: "Text",
                    detail: "Titles and hooks placed over the video. They stay where you put them on the timeline."
                ) {
                    HStack(spacing: 8) {
                        Button {
                            session.addTextLayer()
                        } label: {
                            Label("Text", systemImage: "plus")
                        }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                        .help("Add plain text at the playhead")

                        Button {
                            session.addTextLayer(asHook: true)
                        } label: {
                            Label("Hook", systemImage: "wand.and.stars")
                        }
                        .buttonStyle(EditorPrimaryButtonStyle(size: .small))
                        .help("Add a top-line hook styled for short-form video")
                    }
                    .disabled(session.project.clips.isEmpty || session.isBusy)
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
                        Text("Text layers")
                            .font(.studioBodyStrong)
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
            .frame(minWidth: 150, maxWidth: 300, minHeight: 48, maxHeight: 48, alignment: .leading)
            .fixedSize(horizontal: true, vertical: false)
            .background(selected ? Color.studioSelectedFill : Color.raisedBackground)
            .overlay {
                RoundedRectangle(cornerRadius: 7)
                    .stroke(selected ? Color.studioAccent.opacity(0.8) : Color.studioLine, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.studioPlain)
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
                        .stroke(selected ? Color.studioAccent.opacity(0.78) : Color.studioLine, lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.studioPlain)
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
                    ProgressView().controlSize(.small).tint(Color.studioAccent)
                } else {
                    Image(systemName: icon)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color.studioAccent)
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
        .disabled(disabled || busy)
        .opacity(disabled ? 0.48 : 1)
    }
}

private struct FeatureWorkbench: View {
    let tab: WorkbenchTab

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                StudioGlyph(tab.glyph, size: 22)
                    .foregroundStyle(Color.primary)
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
