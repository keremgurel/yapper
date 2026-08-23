import SwiftUI

/// The editable list of caption lines. Selecting a row seeks to it, so what the
/// creator is restyling is always the card on screen.
struct CaptionListView: View {
    @ObservedObject var session: EditorSession
    @ObservedObject private var captionSelection: CaptionSelectionState
    let onSeek: (Double) -> Void
    /// The row the caret is in. Driven by the arrow keys and by the edits that
    /// split or merge rows, so editing never loses its place.
    @State private var focusedCaptionID: UUID?
    /// Text edits settle into the project on a short coalescing delay. A row
    /// that began empty stays present across that hand-off instead of briefly
    /// vanishing between the AppKit field resigning focus and the model commit.
    @State private var pendingVisibleCaptionIDs: Set<UUID> = []

    init(session: EditorSession, onSeek: @escaping (Double) -> Void) {
        self.session = session
        _captionSelection = ObservedObject(wrappedValue: session.captionSelection)
        self.onSeek = onSeek
    }

    private var captions: [ProjectCaption] { session.captions }
    /// What every card says right now, worked out in one pass rather than once
    /// per row.
    private var liveTexts: [UUID: String] { session.captionTexts }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            actions

            if captions.isEmpty {
                Text("No captions yet. Generate them from your transcript, or add one at the playhead.")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                // Lazy on purpose: every row carries an `NSTextField`, and a
                // fully captioned edit has hundreds of them. Building the lot on
                // each keystroke was most of what made typing in a card lag.
                LazyVStack(spacing: 0) {
                    let texts = liveTexts
                    let visibleCaptions = CaptionListProjection.visibleCaptions(
                        from: captions,
                        textsByID: texts,
                        focusedID: focusedCaptionID,
                        retainingIDs: pendingVisibleCaptionIDs
                    )
                    ForEach(Array(visibleCaptions.enumerated()), id: \.element.id) { index, caption in
                        if index > 0 { Divider().opacity(0.4) }
                        row(caption, number: index + 1, text: texts[caption.id] ?? caption.text)
                            .id(caption.id)
                            .overlay(alignment: .top) {
                                if index > 0 {
                                    CaptionInsertionHandle {
                                        insertCaption(after: visibleCaptions[index - 1].id)
                                    }
                                    .offset(y: -6)
                                }
                            }
                            .zIndex(1)
                        if index == visibleCaptions.count - 1 {
                            CaptionInsertionHandle {
                                insertCaption(after: caption.id)
                            }
                        }
                    }
                }
                .background(Color.studioInputBackground.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .strokeBorder(Color.studioLine, lineWidth: 1)
                }

                HStack {
                    Text("Return splits · Backspace at the start merges up · ↑↓ moves")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 8)
                    Button("Clear all") { Task { await session.clearAllCaptions() } }
                        .buttonStyle(.link)
                        .font(.studioCaption)
                }
            }
        }
    }

    private var actions: some View {
        HStack(spacing: 8) {
            Button {
                Task { await session.addCaptionAtPlayhead() }
            } label: {
                Label("Add at playhead", systemImage: "plus")
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
            .disabled(session.project.clips.isEmpty)
            .help("Add a caption at the playhead")

            if session.canMergeSelectedCaptions {
                Button {
                    Task { await session.mergeSelectedCaptions() }
                } label: {
                    Label("Merge \(session.selectedCaptionIDs.count)", systemImage: "arrow.triangle.merge")
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                .help("Merge the selected captions into one")
            }

            Spacer(minLength: 0)
        }
    }

    private func row(_ caption: ProjectCaption, number: Int, text: String) -> some View {
        let isSelected = session.isCaptionSelected(caption.id)
        return HStack(spacing: 8) {
            Text("\(number)")
                .font(.studioCaption)
                .monospacedDigit()
                .foregroundStyle(isSelected ? Color.yapperOrange : .secondary)
                // Wide enough for a three figure card and never wrapped: at
                // twenty points the hundredth caption broke across two lines
                // and took the row's height with it.
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .frame(width: 26, height: 24, alignment: .trailing)
                .contentShape(Rectangle())
                // A SwiftUI Button brings a focus responder, accessibility
                // attachment and cursor-region NSView with it. There were
                // three of those per visible caption row. This is a pointer
                // handle, while the row exposes the semantic action below.
                .highPriorityGesture(TapGesture().onEnded {
                    pickAndSeek(caption, toggling: true)
                })
                .accessibilityHidden(true)

            Image(systemName: "play.circle")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .frame(width: 20, height: 24)
                .contentShape(Rectangle())
                .highPriorityGesture(TapGesture().onEnded { seek(to: caption) })
                .accessibilityHidden(true)

            CaptionTextField(
                text: Binding(
                    get: { text },
                    set: { typed in
                        // The word that was there is the one the transcriber
                        // heard, so a one-word fix is worth remembering.
                        session.noteCaptionEdit(before: text, after: typed)
                        session.setCaptionText(typed, for: caption.id)
                    }
                ),
                textCase: caption.resolvedStyle(base: session.captionStyle).textCase,
                isFocused: focusedCaptionID == caption.id,
                onFocus: {
                    focusedCaptionID = caption.id
                    selectAndSeek(caption)
                },
                // Only let go if the caret has not already been handed to
                // another row: splitting, merging and the arrow keys all end
                // editing here on their way somewhere else.
                onEndEditing: { finalText in
                    if focusedCaptionID == caption.id { focusedCaptionID = nil }
                    guard finalText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                        retainAcrossPendingCommit(caption.id)
                        return
                    }
                    Task { await session.removeCaption(caption.id) }
                },
                onSplit: { wordsBefore in
                    Task {
                        focusedCaptionID = await session.splitCaption(
                            caption.id,
                            afterWords: wordsBefore
                        )
                    }
                },
                onAddAfter: {
                    insertCaption(after: caption.id)
                },
                onMergeUp: {
                    Task { focusedCaptionID = await session.mergeCaptionIntoPrevious(caption.id) }
                },
                onStep: { step in step < 0 ? focusPrevious(of: caption.id) : focusNext(of: caption.id) }
            )

            Image(systemName: "trash")
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .frame(width: 20, height: 24)
                .contentShape(Rectangle())
                .highPriorityGesture(TapGesture().onEnded {
                    Task { await session.removeCaption(caption.id) }
                })
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 8)
        .frame(height: 28)
        .background(isSelected ? Color.yapperOrange.opacity(0.12) : Color.clear)
        // A bar in the gutter marks the selected line without boxing every row.
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(isSelected ? Color.yapperOrange : Color.clear)
                .frame(width: 2)
        }
        // Anywhere in the row that is not the text, the number or the bin still
        // selects the card and seeks to it, so the whole row is a target.
        .contentShape(Rectangle())
        .onTapGesture { pickAndSeek(caption) }
        .accessibilityAction(named: "Select and jump to caption \(number)") {
            pickAndSeek(caption)
        }
        .accessibilityAction(named: "Play from caption \(number)") {
            seek(to: caption)
        }
        .accessibilityAction(named: "Delete caption \(number)") {
            Task { await session.removeCaption(caption.id) }
        }
        .accessibilityAction(named: "Insert caption after \(number)") {
            insertCaption(after: caption.id)
        }
    }

    private func insertCaption(after id: UUID) {
        Task { focusedCaptionID = await session.addCaption(after: id) }
    }

    private func retainAcrossPendingCommit(_ id: UUID) {
        pendingVisibleCaptionIDs.insert(id)
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(200))
            pendingVisibleCaptionIDs.remove(id)
        }
    }

    private func selectAndSeek(_ caption: ProjectCaption) {
        session.selectCaption(caption.id)
        seek(to: caption)
    }

    /// A click in the list, with whatever is being held down. Shift takes every
    /// card between the last one picked and this one; command picks one out; a
    /// plain click starts again. Going to the card is left to the clicks that
    /// land on one card, because seeking through a run being built would move
    /// the picture out from under the creator.
    private func pickAndSeek(_ caption: ProjectCaption, toggling: Bool = false) {
        let flags = NSEvent.modifierFlags
        let ranging = flags.contains(.shift)
        session.pickCaption(
            caption.id,
            ranging: ranging,
            toggling: toggling || flags.contains(.command)
        )
        guard !ranging, session.isCaptionSelected(caption.id) else { return }
        seek(to: caption)
    }

    /// Moves the playhead to where the card is spoken, and nothing else, so a
    /// creator can hear a line without disturbing what they have picked out.
    private func seek(to caption: ProjectCaption) {
        guard let cue = session.captionCue(caption.id) else { return }
        onSeek(cue.timelineStart + 0.01)
    }

    private func focusPrevious(of id: UUID) {
        guard let index = captions.firstIndex(where: { $0.id == id }), index > 0 else { return }
        focusedCaptionID = captions[index - 1].id
    }

    private func focusNext(of id: UUID) {
        guard
            let index = captions.firstIndex(where: { $0.id == id }),
            index + 1 < captions.count
        else { return }
        focusedCaptionID = captions[index + 1].id
    }
}

/// An insertion target lives only at a row boundary and owns its hover state,
/// so moving the pointer does not invalidate the caption list or its text
/// fields. The hit area is present all the time; the line and plus appear only
/// when the pointer reaches it.
private struct CaptionInsertionHandle: View {
    let insert: () -> Void
    @State private var isHovered = false

    var body: some View {
        ZStack {
            Rectangle()
                .fill(isHovered ? Color.yapperOrange.opacity(0.75) : Color.clear)
                .frame(height: 1)
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 13, weight: .semibold))
                .symbolRenderingMode(.palette)
                .foregroundStyle(
                    isHovered ? Color.white : Color.clear,
                    isHovered ? Color.yapperOrange : Color.clear
                )
                .background {
                    Circle()
                        .fill(isHovered ? Color.studioInputBackground : Color.clear)
                        .frame(width: 15, height: 15)
                }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 12)
        .contentShape(Rectangle())
        .onHover { isHovered = $0 }
        .highPriorityGesture(TapGesture().onEnded(insert))
        .help("Insert a caption here")
        // The row already exposes an "Insert caption after" action. Keeping
        // this pointer-only target out of the accessibility tree avoids one
        // extra native element at every visible boundary.
        .accessibilityHidden(true)
    }
}
