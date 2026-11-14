import SwiftUI

/// The spoken words, to read and to edit by.
///
/// The transcript does not chase the playhead. The word being spoken is marked
/// where it is, and the scroller belongs entirely to whoever is holding it:
/// scrolling back to find a line while the video plays was a fight with an
/// animation that kept pulling the page somewhere else.
struct TranscriptWorkbench: View {
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
    /// A completed timeline seek, published separately so normal playback does
    /// not make the transcript chase the playhead.
    @ObservedObject var seekReveal: TimelineSeekRevealState
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

    /// What a line says, for a reader who is being read to.
    private func lineText(_ line: TranscriptLine) -> String {
        let tokens = flowTokens
        return line.tokens.compactMap { index -> String? in
            guard index < tokens.count else { return nil }
            switch tokens[index] {
            case let .word(word): return word.text
            case .pause: return nil
            }
        }.joined(separator: " ")
    }


    @ViewBuilder
    private func tokenView(at index: Int, playbackWordID: UUID?) -> some View {
        if index < flowTokens.count {
            switch flowTokens[index] {
            case let .word(word):
                transcriptWordToken(word, playbackWordID: playbackWordID)
            case let .pause(pause):
                transcriptPauseToken(pause)
            }
        }
    }

    private func activateToken(at index: Int) {
        guard flowTokens.indices.contains(index) else { return }
        switch flowTokens[index] {
        case let .word(word):
            select(
                word,
                kept: session.transcriptFlowCache.keptWordIDs.contains(word.id)
            )
        case let .pause(pause):
            activatePause(pause)
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
            TranscriptHeader(session: session, wordCount: words.count)

            if session.isAIEditing {
                ProgressView(value: session.aiProgress).tint(Color.studioAccent)
                Text(session.statusMessage).font(.studioCaption).foregroundStyle(Color.studioTextMuted)
                if session.canCancelCurrentOperation,
                   let operation = session.activeOperation?.operation {
                    Button(operation.cancelLabel) { session.cancelCurrentOperation() }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                }
            }

            if words.isEmpty {
                ContentUnavailableView {
                    Label {
                        Text("No transcript yet")
                    } icon: {
                        StudioGlyph(.transcript, size: 30)
                    }
                } description: {
                    Text("Transcribe your take to cut it by deleting words and to make captions. Your timeline is kept as it is.")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // Measured here rather than reported up from a preference. The
                // wrapping is arithmetic over this width, so it has to be the
                // width the panel has now: read from a layer behind the
                // scroller, the transcript went on wrapping to the width the
                // panel used to have and left the rest of the pane empty.
                GeometryReader { geometry in
                    ScrollViewReader { scrollProxy in
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
                                        .contentShape(Rectangle())
                                        // One hit target per visible line, then
                                        // arithmetic decides which token was under
                                        // the pointer. The old version made every
                                        // word a Button. Despite combining the row
                                        // for accessibility, SwiftUI still built a
                                        // focus responder, help attachment, action
                                        // and gesture for every word. A real 2,214
                                        // word project spent most of a scroll walk
                                        // maintaining that invisible control tree.
                                        .simultaneousGesture(
                                            SpatialTapGesture().onEnded { value in
                                                guard let index = TranscriptLineBreaker.token(
                                                    atX: value.location.x,
                                                    in: line,
                                                    widths: tokenWidths
                                                ) else { return }
                                                activateToken(at: index)
                                            }
                                        )
                                        // A transcript is read by line. Ignoring
                                        // the decorative token children also keeps
                                        // assistive tools from rebuilding them as
                                        // separate elements while the page moves.
                                        .accessibilityElement(children: .ignore)
                                        .accessibilityLabel(lineText(line))
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
                                    .fill(Color.studioAccent.opacity(0.08))
                                    .overlay {
                                        Rectangle()
                                            .stroke(Color.studioAccent.opacity(0.55), lineWidth: 1)
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
                        .onChange(of: seekReveal.request) { _, request in
                            guard
                                let request,
                                let wordID = session.transcriptFlowCache.nearestWordID(
                                    to: request.timelineTime
                                ),
                                let lineID = session.transcriptFlowCache.lineID(
                                    forWordID: wordID,
                                    width: flowWidth
                                )
                            else { return }
                            // A direct jump, not an animation and not a clock
                            // follower: one lazy row is materialised once.
                            scrollProxy.scrollTo(lineID, anchor: .center)
                        }
                        .highPriorityGesture(marqueeGesture)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var selectionBar: some View {
        TranscriptSelectionBar(
            selectedCount: selection.wordIDs.count,
            restorableCount: selectedDeletedWords.count,
            deletableCount: selectedKeptWords.count,
            onRestore: applyRestore,
            onDelete: applyDelete,
            onClear: { selection.clear() }
        )
        .disabled(isApplyingSelection)
        .padding(.bottom, 10)
    }

    private var marqueeRectangle: CGRect? {
        guard let marqueeStart, let marqueeCurrent else { return nil }
        return Self.rectangle(from: marqueeStart, to: marqueeCurrent)
    }

    private func transcriptWordToken(_ word: TranscriptWord, playbackWordID: UUID?) -> some View {
        let kept = session.transcriptFlowCache.keptWordIDs.contains(word.id)
        let active = playbackWordID == word.id
        return Text(word.text)
            .font(.system(size: 14, weight: active ? .bold : kept ? .medium : .regular))
            .foregroundStyle(wordForeground(wordID: word.id, kept: kept))
            .strikethrough(!kept, color: selection.wordIDs.contains(word.id) ? Color.white : Color.studioTextMuted)
            .padding(.horizontal, 3)
            .padding(.vertical, 3)
            .background(wordBackground(wordID: word.id, kept: kept, active: active))
            .clipShape(RoundedRectangle(cornerRadius: StudioRadius.tag, style: .continuous))
            .accessibilityHidden(true)
            .id(word.id)
    }

    private func transcriptPauseToken(_ pause: TranscriptPause) -> some View {
        let kept = session.project.isSourceRangeKept(
            mediaID: pause.mediaID,
            start: pause.start,
            end: pause.end
        )
        return Text(pause.label)
            .font(.studioTimecodeMicro)
            .foregroundStyle(kept ? Color.studioTextMuted : Color.studioTextMuted.opacity(0.5))
            .strikethrough(!kept, color: Color.studioTextMuted.opacity(0.6))
            .padding(.horizontal, 5)
            .padding(.vertical, 3)
            .background(kept ? Color.studioFaintFill : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: StudioRadius.tag, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: StudioRadius.tag, style: .continuous)
                    .stroke(kept ? Color.studioLine : Color.clear, lineWidth: 1)
            }
            .accessibilityHidden(true)
    }

    private func activatePause(_ pause: TranscriptPause) {
        let kept = session.project.isSourceRangeKept(
            mediaID: pause.mediaID,
            start: pause.start,
            end: pause.end
        )
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
        return kept ? .primary : Color.studioTextMuted.opacity(0.7)
    }

    private func wordBackground(wordID: UUID, kept: Bool, active: Bool) -> Color {
        if selection.wordIDs.contains(wordID) {
            return kept ? Color.studioDanger.opacity(0.85) : Color.studioSuccess.opacity(0.85)
        }
        if active { return Color.studioSelectedFill }
        return Color.clear
    }
}
