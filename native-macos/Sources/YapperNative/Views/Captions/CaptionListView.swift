import SwiftUI

/// The editable list of caption lines. Selecting a row seeks to it, so what the
/// creator is restyling is always the card on screen.
struct CaptionListView: View {
    @ObservedObject var session: EditorSession
    let onSeek: (Double) -> Void
    /// The row the caret is in. Driven by the arrow keys and by the edits that
    /// split or merge rows, so editing never loses its place.
    @State private var focusedCaptionID: UUID?

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
                    ForEach(Array(captions.enumerated()), id: \.element.id) { index, caption in
                        if index > 0 { Divider().opacity(0.4) }
                        row(caption, number: index + 1, text: texts[caption.id] ?? caption.text)
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
                Label("Add caption", systemImage: "plus")
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
        // Every word this card covered has been cut, so it is drawing nothing.
        // It stays in the list, dimmed, because restoring those words in the
        // transcript brings it straight back.
        let isEmptied = text.trimmingCharacters(in: .whitespaces).isEmpty
        return HStack(spacing: 8) {
            Button {
                // The number is the multi-select handle, so a plain click on it
                // picks the card out rather than replacing the run.
                pickAndSeek(caption, toggling: true)
            } label: {
                Text("\(number)")
                    .font(.studioCaption)
                    .monospacedDigit()
                    .foregroundStyle(isSelected ? Color.yapperOrange : .secondary)
                    // Wide enough for a three figure card and never wrapped: at
                    // twenty points the hundredth caption broke across two
                    // lines and took the row's height with it.
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .frame(width: 26, alignment: .trailing)
            }
            .buttonStyle(.studioPlain)
        .clickableCursor()
            .help("Select and jump here. Click several to restyle or merge them together.")

            Button {
                seek(to: caption)
            } label: {
                Image(systemName: "play.circle")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.studioPlain)
            .clickableCursor()
            .help("Jump the playhead here")

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
                onEndEditing: {
                    if focusedCaptionID == caption.id { focusedCaptionID = nil }
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
                    Task { focusedCaptionID = await session.addCaption(after: caption.id) }
                },
                onMergeUp: {
                    Task { focusedCaptionID = await session.mergeCaptionIntoPrevious(caption.id) }
                },
                onStep: { step in step < 0 ? focusPrevious(of: caption.id) : focusNext(of: caption.id) }
            )

            Button {
                Task { await session.removeCaption(caption.id) }
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.studioPlain)
        .clickableCursor()
            .help("Delete caption")
        }
        .opacity(isEmptied ? 0.45 : 1)
        .help(isEmptied ? "Every word on this card is cut from the transcript" : "")
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
        .contextMenu {
            PropertiesMenuItems(session: session, item: .caption(caption.id))
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
