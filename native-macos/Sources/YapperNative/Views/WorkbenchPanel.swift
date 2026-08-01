import SwiftUI
import UniformTypeIdentifiers

private enum WorkbenchTab: String, CaseIterable, Identifiable {
    case media = "Media"
    case quick = "Quick Edit"
    case transcript = "Transcript"
    case audio = "Audio"
    case text = "Text"
    case captions = "Captions"
    case filters = "Filters"

    var id: String { rawValue }
    var icon: String {
        switch self {
        case .media: "film.stack"
        case .quick: "wand.and.stars"
        case .transcript: "doc.text"
        case .audio: "waveform"
        case .text: "textformat"
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
    @AppStorage("workbenchTabOrder") private var tabOrderRaw = ""

    var body: some View {
        VStack(spacing: 0) {
            workbenchTabStrip

            Rectangle()
                .fill(Color.yapperOrange)
                .frame(height: 2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .opacity(0.75)

            GeometryReader { proxy in
                ZStack {
                    workbenchDock(width: proxy.size.width)

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
                    .onAppear { workbenchWidth = proxy.size.width }
                    .onChange(of: proxy.size.width) { _, width in
                        workbenchWidth = width
                    }
            }
        }
        .coordinateSpace(name: "workbenchDock")
        .onAppear(perform: restoreTabOrder)
        .onChange(of: session.inspectorRequest) { _, request in
            guard let request, let tab = WorkbenchTab(rawValue: request.tool) else { return }
            withAnimation(.easeOut(duration: 0.14)) {
                selectedTab = tab
                dockFocus = .primary
            }
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
                        .buttonStyle(.plain)
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
                    .buttonStyle(.plain)
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
            TranscriptWorkbench(session: session)
        case .audio:
            AudioWorkbench(session: session)
        case .text:
            TextWorkbench(session: session)
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
        .buttonStyle(.plain)
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
            dockFocus = .primary
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
                    .buttonStyle(.plain)
                    .help("Close secondary pane")
                }
            }
            .padding(.horizontal, 11)
            .frame(height: 36)
            .background(Color.raisedBackground)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(focused ? Color.yapperOrange.opacity(0.78) : Color.studioLine)
                    .frame(height: focused ? 2 : 1)
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

private struct MediaWorkbench: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Media")
                        .font(.system(size: 15, weight: .bold))
                    Text("Video stays local on this Mac")
                        .font(.studioBody)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Import") { ImportPanels.openMedia(for: session) }
                    .buttonStyle(EditorSecondaryButtonStyle())
            }

            if session.project.media.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "plus.rectangle.on.rectangle")
                            .font(.system(size: 23, weight: .light))
                            .foregroundStyle(Color.yapperOrange)
                            .frame(width: 30)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("No media yet")
                                .font(.studioBodyStrong)
                            Text("Import one or several videos, images, or B-roll files. They stay local on this Mac.")
                                .font(.studioCaption)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    Button {
                        ImportPanels.openMedia(for: session)
                    } label: {
                        Label("Import media", systemImage: "square.and.arrow.down")
                    }
                    .buttonStyle(EditorPrimaryButtonStyle())
                }
                .padding(16)
                .frame(maxWidth: 440, alignment: .leading)
                .background(Color.raisedBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 9)
                        .stroke(Color.studioLine, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 9))
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 10) {
                        ForEach(session.project.media) { media in
                            HStack(spacing: 10) {
                                Group {
                                    if let image = session.thumbnailsByMedia[media.id]?.first {
                                        Image(decorative: image, scale: 1)
                                            .resizable()
                                            .scaledToFill()
                                    } else {
                                        Rectangle().fill(Color.black)
                                            .overlay(ProgressView().controlSize(.small))
                                    }
                                }
                                .frame(width: 112, height: 64)
                                .clipped()
                                .clipShape(RoundedRectangle(cornerRadius: 6))

                                VStack(alignment: .leading, spacing: 5) {
                                    Text(media.name)
                                        .font(.studioBodyStrong)
                                        .lineLimit(2)
                                    Text("\(media.width)×\(media.height) · \(formatTime(media.duration))")
                                        .font(.studioCaption)
                                        .foregroundStyle(.secondary)
                                    if let progress = session.waveformProgressByMedia[media.id], progress < 1 {
                                        ProgressView(value: progress)
                                            .tint(.cyan)
                                    } else {
                                        Label("Waveform ready", systemImage: "waveform")
                                            .font(.studioCaption)
                                            .foregroundStyle(.cyan)
                                    }
                                }
                                Spacer(minLength: 0)
                                HStack(spacing: 6) {
                                    if !media.isImage {
                                        Button("Base") {
                                            Task { await session.appendMediaToTimeline(media.id) }
                                        }
                                        .buttonStyle(EditorSecondaryButtonStyle())
                                    }
                                    Button("Overlay") {
                                        Task { await session.addOverlay(media.id) }
                                    }
                                    .buttonStyle(EditorSecondaryButtonStyle())
                                    .disabled(session.project.clips.isEmpty || !media.isImage)
                                }
                            }
                            .padding(9)
                            .background(Color.raisedBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 9))
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .inspectorPane(maxWidth: 720)
    }
}

private struct QuickEditWorkbench: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Quick Edit")
                .font(.system(size: 15, weight: .bold))
            Text("AI edits will operate on this native timeline without rebuilding the player between clips.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 10) {
                QuickAction(
                    title: (session.project.transcript?.isEmpty == false) ? "Transcribe Again" : "Transcribe",
                    detail: "Accurate timed words",
                    icon: "doc.text",
                    busy: session.isAIEditing
                ) {
                    Task { await session.transcribeProject() }
                }
                QuickAction(
                    title: session.isAIEditing ? "Editing…" : "1-Click Edit",
                    detail: "Retakes + dead pauses",
                    icon: "wand.and.stars",
                    busy: session.isAIEditing
                ) {
                    Task { await session.runOneClickEdit() }
                }
                QuickAction(
                    title: "Add Captions",
                    detail: "Not migrated yet",
                    icon: "captions.bubble",
                    disabled: true
                ) {}
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

            Divider()
            Text("Native timeline tools")
                .font(.studioCaptionStrong)
                .foregroundStyle(.secondary)
            HStack {
                Button("Split at playhead") {
                    Task { await session.splitAtPlayhead() }
                }
                .buttonStyle(EditorSecondaryButtonStyle())
                Button("Delete clip") {
                    Task { await session.deleteSelected() }
                }
                .buttonStyle(EditorSecondaryButtonStyle())
                .disabled(session.selectedClipID == nil)
                Button("Reset to source") {
                    Task { await session.resetTimelineToSource() }
                }
                .buttonStyle(EditorSecondaryButtonStyle())
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
                        selectedLayerEditor(layer)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: 680, alignment: .leading)
        }
        .inspectorPane(maxWidth: 680)
    }

    @ViewBuilder
    private func selectedLayerEditor(_ layer: ProjectTextLayer) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            InspectorLabel("COPY")
            TextEditor(text: binding(for: layer, keyPath: \ProjectTextLayer.text))
                .font(.system(size: 15, weight: .semibold))
                .scrollContentBackground(.hidden)
                .padding(8)
                .frame(minHeight: 76, maxHeight: 116)
                .background(Color.studioInputBackground)
                .overlay {
                    RoundedRectangle(cornerRadius: 7)
                        .stroke(Color.studioLine, lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 7))

            InspectorLabel("STYLE")
            HStack(spacing: 7) {
                ForEach(TextLayerStyle.allCases) { style in
                    ChoiceButton(
                        title: style.title,
                        selected: layer.style == style
                    ) {
                        var updated = layer
                        updated.style = style
                        session.updateTextLayer(updated)
                    }
                }
            }

            HStack(alignment: .top, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    InspectorLabel("FONT")
                    Picker("Font", selection: binding(for: layer, keyPath: \ProjectTextLayer.font)) {
                        ForEach(TextLayerFont.allCases) { font in
                            Text(font.title).tag(font)
                        }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                    .frame(maxWidth: 310)
                }

                VStack(alignment: .leading, spacing: 8) {
                    InspectorLabel("POSITION")
                    HStack(spacing: 6) {
                        positionButton("Top", y: 0.16, layer: layer)
                        positionButton("Center", y: 0.5, layer: layer)
                        positionButton("Bottom", y: 0.82, layer: layer)
                    }
                }
            }

            SliderControl(
                title: "Size",
                value: binding(for: layer, keyPath: \ProjectTextLayer.fontScale),
                range: 0.025 ... 0.12,
                valueLabel: "\(Int(layer.fontScale * 1_000))"
            )
            SliderControl(
                title: "Width",
                value: binding(for: layer, keyPath: \ProjectTextLayer.width),
                range: 0.25 ... 0.95,
                valueLabel: "\(Int(layer.width * 100))%"
            )
            HStack {
                Label(
                    "\(formatTimePrecise(layer.timelineStart)) – \(formatTimePrecise(layer.timelineStart + layer.duration)) · trim on timeline",
                    systemImage: "arrow.left.and.right"
                )
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button(role: .destructive) {
                    session.deleteSelectedTextLayer()
                } label: {
                    Label("Delete layer", systemImage: "trash")
                }
                .buttonStyle(EditorSecondaryButtonStyle())
            }
        }
    }

    private func positionButton(_ title: String, y: Double, layer: ProjectTextLayer) -> some View {
        ChoiceButton(title: title, selected: abs(layer.y - y) < 0.06) {
            var updated = layer
            updated.y = y
            session.updateTextLayer(updated)
        }
    }

    private func binding<Value>(
        for layer: ProjectTextLayer,
        keyPath: WritableKeyPath<ProjectTextLayer, Value>
    ) -> Binding<Value> {
        Binding(
            get: {
                session.project.textLayers?.first(where: { $0.id == layer.id })?[keyPath: keyPath]
                    ?? layer[keyPath: keyPath]
            },
            set: { value in
                guard var updated = session.project.textLayers?.first(where: { $0.id == layer.id }) else { return }
                updated[keyPath: keyPath] = value
                session.updateTextLayer(updated)
            }
        )
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
        .buttonStyle(.plain)
    }
}

private struct InspectorLabel: View {
    let title: String

    init(_ title: String) { self.title = title }

    var body: some View {
        Text(title)
            .font(.studioCaptionStrong)
            .foregroundStyle(.secondary)
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
        .buttonStyle(.plain)
    }
}

private struct SliderControl: View {
    let title: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let valueLabel: String

    var body: some View {
        HStack(spacing: 10) {
            Text(title)
                .font(.studioBodyStrong)
                .frame(width: 66, alignment: .leading)
            Slider(value: $value, in: range)
                .frame(maxWidth: 330)
            Text(valueLabel)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(.secondary)
                .frame(width: 48, alignment: .trailing)
        }
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
        .buttonStyle(.plain)
        .disabled(disabled || busy)
        .opacity(disabled ? 0.48 : 1)
    }
}

private struct TranscriptWorkbench: View {
    @ObservedObject var session: EditorSession

    private var words: [TranscriptWord] { session.project.transcript ?? [] }

    var body: some View {
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
                ScrollView {
                    TranscriptFlowLayout(spacing: 6) {
                        ForEach(words) { word in
                            let kept = session.project.isWordKept(word)
                            Text(word.text)
                                .font(.system(size: 14, weight: kept ? .medium : .regular))
                                .foregroundStyle(kept ? Color.primary : Color.secondary.opacity(0.58))
                                .strikethrough(!kept, color: Color.secondary)
                                .padding(.vertical, 3)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(16)
        .inspectorPane(maxWidth: 760)
    }
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

                LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
                    ForEach(SoundEffectDescriptor.library) { effect in
                        SoundEffectCard(effect: effect, disabled: session.project.clips.isEmpty) {
                            Task { await session.previewSoundEffect(effect) }
                        } add: {
                            Task { await session.addSoundEffect(effect) }
                        }
                    }
                }
                .frame(maxWidth: 528, alignment: .leading)

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
                            .buttonStyle(.plain)
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
                Button(role: .destructive) {
                    Task { await session.deleteSelectedAudioLayer() }
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                .buttonStyle(EditorSecondaryButtonStyle())
            }

            HStack(spacing: 7) {
                Text("Volume")
                    .font(.studioCaptionStrong)
                    .foregroundStyle(.secondary)
                ForEach([0.5, 0.75, 1.0, 1.25], id: \.self) { volume in
                    ChoiceButton(
                        title: "\(Int(volume * 100))%",
                        selected: abs(layer.volume - volume) < 0.01
                    ) {
                        var updated = layer
                        updated.volume = volume
                        Task { await session.updateAudioLayer(updated) }
                    }
                }
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
                Image(systemName: "play.fill")
                    .font(.system(size: 10, weight: .bold))
                    .frame(width: 27, height: 27)
            }
            .buttonStyle(.plain)
            .background(Color.studioFaintFill)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .help("Preview \(effect.name)")

            Button(action: add) {
                Image(systemName: "plus")
                    .font(.system(size: 11, weight: .bold))
                    .frame(width: 27, height: 27)
            }
            .buttonStyle(.plain)
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

private struct TranscriptFlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        layout(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let result = layout(
            proposal: ProposedViewSize(width: bounds.width, height: proposal.height),
            subviews: subviews
        )
        for (index, point) in result.points.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y),
                anchor: .topLeading,
                proposal: .unspecified
            )
        }
    }

    private func layout(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, points: [CGPoint]) {
        let width = proposal.width ?? 480
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var points: [CGPoint] = []
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            points.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return (CGSize(width: width, height: y + rowHeight), points)
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

private extension View {
    func inspectorPane(maxWidth: CGFloat) -> some View {
        HStack(spacing: 0) {
            self.frame(maxWidth: maxWidth, maxHeight: .infinity, alignment: .topLeading)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

func formatTime(_ seconds: Double) -> String {
    guard seconds.isFinite else { return "0:00" }
    let total = max(0, Int(seconds.rounded()))
    return String(format: "%d:%02d", total / 60, total % 60)
}
