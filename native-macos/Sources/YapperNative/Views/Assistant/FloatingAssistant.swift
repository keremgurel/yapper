import SwiftUI

/// Yapper, in the corner of the editor.
///
/// Press the bird and it grows into the command bar; drag it and it goes
/// wherever it is put. It floats over the whole editor rather than living in a
/// tab, because what you want to say to it does not belong to any one panel —
/// and because a thing you can move is a thing that is never in the way.
struct FloatingAssistant: View {
    @ObservedObject var session: EditorSession
    /// Watched here as well, so the bird reacts to every kind of request and
    /// not only to the overlay pass, which is the only one the session's own
    /// placement status knows about.
    @ObservedObject var conversation: AssistantConversation

    /// Read from the session so ⌘K and Escape can open and close it too.
    private var isOpen: Bool { session.isAssistantOpen }
    /// Where it was last put, and the size it was that size when it was put
    /// there. Both, because the same corner means a different top-left for a
    /// 62pt bubble and a 560pt panel, and the conversion between them has to
    /// happen while it is being drawn rather than a beat afterwards.
    @State private var placement: AssistantPlacement?
    /// Where the drag started, so the whole gesture is one move rather than a
    /// series of increments that drift.
    @State private var dragOrigin: AssistantAnchor?
    @State private var isDragging = false
    /// Set while a drag is running so the press that ends it is not read as a
    /// click on the bird.
    @State private var wasDragged = false
    @State private var isHovering = false
    /// The panel size the resize gesture started from, so the whole drag is one
    /// change rather than a run of increments that drift.
    @State private var resizeOrigin: CGSize?
    /// And where its corner was, because pulling a top or leading edge moves
    /// the corner as well as the size.
    @State private var resizeAnchorOrigin: AssistantAnchor?

    private static let bubbleSize = CGSize(width: 62, height: 62)
    /// What it opens at. Dragging the corner changes it from there, because how
    /// much room a sentence needs is not something a default can know.
    private static let defaultPanelSize = CGSize(width: 560, height: 460)
    private static let minimumPanelSize = CGSize(width: 320, height: 220)

    @State private var panelSize = FloatingAssistant.defaultPanelSize

    private var size: CGSize { isOpen ? panelSize : Self.bubbleSize }

    private var isWorking: Bool {
        conversation.isThinking || session.overlayPlacement == .working
    }

    /// What his face is doing, taken from the last thing he said. Closed in the
    /// corner, the bird is the only report you get, so a failure has to be
    /// visible on him without opening the panel.
    private var expression: ChirpyMascot.Expression {
        if isWorking { return .yap }
        switch conversation.messages.last?.tone {
        case .trouble: return .oops
        case .done: return .happy
        case .asked, nil: break
        }
        return isHovering ? .curious : .idle
    }

    var body: some View {
        GeometryReader { proxy in
            let placed = self.placed(in: proxy.size)

            content(in: proxy.size)
                .frame(width: size.width, height: size.height, alignment: .topLeading)
                .offset(x: placed.x, y: placed.y)
                .onChange(of: proxy.size) { _, bounds in
                    // A resized window must never leave it stranded off an edge.
                    placement = AssistantPlacement(
                        anchor: AssistantAnchor.clamped(placed, size: size, within: bounds),
                        size: size
                    )
                }
        }
        // Short and monotonic rather than a spring. The frame goes from 62pt to
        // 560pt, and every frame of that springs a full relayout of a panel
        // holding a scroller and two AppKit text views — half a second of it,
        // with an overshoot at the end. The scale-and-fade below is what the
        // motion should come from; the size just needs to get out of the way.
        .animation(.easeOut(duration: 0.17), value: isOpen)
        .ignoresSafeArea(.keyboard)
    }

    @ViewBuilder
    private func content(in bounds: CGSize) -> some View {
        if isOpen {
            AssistantPanel(
                session: session,
                conversation: session.conversation,
                expression: expression,
                isWorking: isWorking,
                onClose: { toggle(open: false, in: bounds) },
                onEscape: { session.closeAssistant() },
                onDrag: { translation in drag(by: translation, in: bounds) },
                onDragEnded: endDrag,
                onResize: { edge, translation in resize(edge: edge, by: translation, in: bounds) },
                onResizeEnded: endResize
            )
            .transition(.scale(scale: 0.9, anchor: .bottomTrailing).combined(with: .opacity))
        } else {
            bubble(in: bounds)
                .transition(.scale(scale: 0.9, anchor: .bottomTrailing).combined(with: .opacity))
        }
    }

    private func bubble(in bounds: CGSize) -> some View {
        ChirpyMascot(expression: expression, talking: isWorking, size: 46)
            .frame(width: Self.bubbleSize.width, height: Self.bubbleSize.height)
            .studioGlass(radius: Self.bubbleSize.width / 2)
            .overlay {
                Circle()
                    .strokeBorder(
                        Color.yapperOrange.opacity(isHovering ? 0.55 : 0.28),
                        lineWidth: 1
                    )
            }
            .shadow(
                color: .black.opacity(isDragging ? 0.42 : 0.26),
                radius: isDragging ? 18 : 10,
                y: isDragging ? 10 : 5
            )
            .scaleEffect(isDragging ? 1.06 : (isHovering ? 1.03 : 1))
            .gesture(dragGesture(in: bounds))
            // The carry itself must never be animated, or every frame of it
            // chases a spring instead of the mouse.
            .transaction { if isDragging { $0.disablesAnimations = true } }
            .onHover { isHovering = $0 }
            .onTapGesture {
                // The press that just ended may have been a drag, not a click.
                guard !wasDragged else { return }
                toggle(open: true, in: bounds)
            }
            .help("Ask Yapper for an edit · drag to move")
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isDragging)
            .animation(.easeOut(duration: 0.14), value: isHovering)
    }

    private func dragGesture(in bounds: CGSize) -> some Gesture {
        // Measured against the screen, not against Chirpy. A drag reported in a
        // view's own space is measured against something that is moving with
        // the drag, so it under-reports and the bird trails the pointer.
        DragGesture(minimumDistance: 2, coordinateSpace: .global)
            .onChanged { drag(by: $0.translation, in: bounds) }
            .onEnded { _ in endDrag() }
    }

    private func drag(by translation: CGSize, in bounds: CGSize) {
        if dragOrigin == nil { dragOrigin = placed(in: bounds) }
        guard let dragOrigin else { return }
        isDragging = true
        wasDragged = true
        placement = AssistantPlacement(
            anchor: AssistantAnchor.clamped(
                AssistantAnchor(
                    x: dragOrigin.x + translation.width,
                    y: dragOrigin.y + translation.height
                ),
                size: size,
                within: bounds
            ),
            size: size
        )
    }

    /// Pulls any edge or corner. Every step measures from where the panel was
    /// when the edge was grabbed, so the steps never compound.
    private func resize(edge: PanelResizeEdge, by translation: CGSize, in bounds: CGSize) {
        if resizeOrigin == nil {
            resizeOrigin = panelSize
            resizeAnchorOrigin = placed(in: bounds)
        }
        guard let resizeOrigin, let resizeAnchorOrigin else { return }
        let resized = PanelResizeGeometry.resized(
            anchor: resizeAnchorOrigin,
            size: resizeOrigin,
            edge: edge,
            translation: translation,
            minimum: Self.minimumPanelSize,
            within: bounds
        )
        panelSize = resized.size
        placement = AssistantPlacement(anchor: resized.anchor, size: resized.size)
    }

    private func endResize() {
        resizeOrigin = nil
        resizeAnchorOrigin = nil
    }

    private func endDrag() {
        dragOrigin = nil
        isDragging = false
        // Let the tap that ends this drag pass before listening again.
        DispatchQueue.main.async { wasDragged = false }
    }

    /// Where it sits right now, worked out rather than stored.
    private func placed(in bounds: CGSize) -> AssistantAnchor {
        AssistantPlacement.anchor(for: size, lastPut: placement, within: bounds)
    }

    private func toggle(open: Bool, in bounds: CGSize) {
        session.isAssistantOpen = open
    }
}

/// The command bar itself, once the bird has grown into it.
private struct AssistantPanel: View {
    @ObservedObject var session: EditorSession
    /// Watched here as well as through the session: a reply landing has to
    /// redraw the transcript, and the session never hears about it.
    @ObservedObject var conversation: AssistantConversation
    let expression: ChirpyMascot.Expression
    let isWorking: Bool
    let onClose: () -> Void
    /// Escape, once the `@` list has had its chance at it.
    let onEscape: () -> Void
    let onDrag: (CGSize) -> Void
    let onDragEnded: () -> Void
    let onResize: (PanelResizeEdge, CGSize) -> Void
    let onResizeEnded: () -> Void

    /// Held out here rather than inside the box so an example can be pressed
    /// into it from the empty state.
    @State private var draft = ""
    @State private var caret = 0
    @State private var focusRequest = 0
    /// Set by Escape, so the list can be put away without giving up the `@`
    /// that is already typed.
    @State private var mentionDismissed = false
    @State private var mentionActive = 0

    private var mention: MentionQuery {
        MentionQuery(
            text: draft,
            caret: caret,
            in: session.placeableMedia,
            isDismissed: mentionDismissed
        )
    }

    @ViewBuilder
    private var transcript: some View {
        if conversation.isEmpty {
            AssistantEmptyState(onPick: {
                draft = $0
                focusRequest += 1
            })
        } else {
            AssistantTranscript(conversation: conversation)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider().opacity(0.5)
            content
            composer
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .studioGlassBackground(radius: 16)
        .shadow(color: .black.opacity(0.34), radius: 26, y: 12)
        .overlay { PanelResizeHandles(onResize: onResize, onEnded: onResizeEnded) }
        // Opening it is asking to say something. The panel is built the moment
        // it opens and torn down when it closes, so appearing is exactly the
        // event, whether that was ⌘K or the bird being clicked.
        .onAppear { focusRequest += 1 }
    }

    /// The conversation, and the `@` list when there is one.
    ///
    /// The list is drawn here, inside the panel, sitting on top of the
    /// conversation and directly above the box. Not as an overlay hanging off
    /// the box: an overlay is outside the layout, so nothing bounded it, and in
    /// a panel near the bottom of the screen it covered the box you were typing
    /// into and ran off the screen at the same time. Here it can do neither.
    private var content: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                transcript
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

                if mention.isActive {
                    MentionSuggestionList(
                        files: mention.files,
                        active: min(mentionActive, mention.files.count - 1),
                        availableHeight: proxy.size.height - 12,
                        onPick: accept,
                        onHover: { mentionActive = $0 }
                    )
                    .padding(.horizontal, 10)
                    .padding(.bottom, 6)
                    .transition(.opacity.combined(with: .offset(y: 8)))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Whatever happens, nothing in here leaves the panel.
        .clipped()
        .animation(.easeOut(duration: 0.12), value: mention.isActive)
        .onChange(of: draft) { _, _ in
            mentionDismissed = false
            mentionActive = 0
        }
    }

    private var composer: some View {
        AssistantComposer(
            session: session,
            instruction: $draft,
            caret: $caret,
            placeholder: AssistantComposer.placeholder,
            isWorking: isWorking,
            focusRequest: $focusRequest,
            onListKey: handleListKey,
            onEscape: onEscape,
            onSend: send
        )
        .frame(height: 96)
        .padding(10)
    }

    /// Returns true when the key belonged to the list rather than to the text.
    private func handleListKey(_ key: MentionTextView.ListKey) -> Bool {
        let files = mention.files
        guard !files.isEmpty else { return false }
        switch key {
        case .up:
            mentionActive = (mentionActive - 1 + files.count) % files.count
        case .down:
            mentionActive = (mentionActive + 1) % files.count
        case .accept:
            accept(files[min(mentionActive, files.count - 1)])
        case .dismiss:
            mentionDismissed = true
        }
        return true
    }

    private func accept(_ file: ProjectMedia) {
        guard let result = mention.accepting(file, in: draft) else { return }
        draft = result.text
        caret = result.caret
        mentionActive = 0
        focusRequest += 1
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !isWorking, !text.isEmpty else { return }
        // Emptied the moment it is sent, the way a message box is: what you
        // asked for is in the transcript above now, not still under a cursor.
        draft = ""
        caret = 0
        // The assistant reaches every command the editor has, so a sentence
        // about silences trims silences rather than being read as an overlay
        // it cannot find.
        Task { await session.runAssistant(instruction: text) }
    }

    private var header: some View {
        HStack(spacing: 10) {
            ChirpyMascot(expression: expression, talking: isWorking, size: 30)

            VStack(alignment: .leading, spacing: 1) {
                Text("Ask Yapper")
                    .font(.system(size: 12, weight: .bold))
                Text(isWorking ? "Working on it…" : "Yapper")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.secondary)
                    .frame(width: 22, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Put Chirpy back in the corner")
        }
        .padding(.horizontal, 12)
        .frame(height: 46)
        // The header is the handle. Dragging the body instead would mean every
        // attempt to select a word in the box threw the panel across the screen.
        .contentShape(Rectangle())
        .gesture(
            // Against the screen, for the same reason the bubble is: the header
            // is carried along by the drag it is reporting.
            DragGesture(minimumDistance: 2, coordinateSpace: .global)
                .onChanged { onDrag($0.translation) }
                .onEnded { _ in onDragEnded() }
        )
    }
}
