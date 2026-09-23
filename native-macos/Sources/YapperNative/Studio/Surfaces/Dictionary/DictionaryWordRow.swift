import SwiftUI

/// One saved spelling: the spelling itself, edited in place, and below it the
/// mishearings that get corrected to it.
struct DictionaryWordRow: View {
    let entry: DictionaryEntry
    @StateObject private var editor: DictionaryRowEditor
    @State private var term: String
    @FocusState private var termFocused: Bool

    init(entry: DictionaryEntry, store: DictionaryPageStore) {
        self.entry = entry
        _editor = StateObject(wrappedValue: DictionaryRowEditor(id: entry.id, store: store))
        _term = State(initialValue: entry.term)
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Rectangle().fill(Color.studioLine).frame(height: 1)
            VStack(alignment: .leading, spacing: 8) {
                DictionaryAliasStrip(entry: entry, editor: editor, term: term)
                if let message = editor.message {
                    failure(message)
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background(Color.studioFaintFill.opacity(0.5))
        }
        .background(NativeCardBackground())
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .onChange(of: entry.term) { _, saved in
            if !termFocused { term = saved }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                TextField("Preferred spelling", text: $term)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15, weight: .semibold))
                    .focused($termFocused)
                    .disabled(editor.saving)
                    .onSubmit(commitTerm)
                    .onChange(of: termFocused) { _, focused in
                        if !focused { commitTerm() }
                    }
                Text("Preferred spelling sent to the transcriber")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 12)
            if editor.saving {
                ProgressView().controlSize(.small)
            }
            DictionaryDeleteControl(term: entry.term, disabled: editor.saving) {
                Task { await editor.remove() }
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }

    private func failure(_ message: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(message)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.studioDanger)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button("Retry change") {
                Task {
                    if let saved = await editor.retry() { term = saved.term }
                }
            }
            .buttonStyle(EditorGhostButtonStyle(size: .small))
            .disabled(editor.saving)
        }
    }

    private func commitTerm() {
        guard TranscriptionDictionary.cleanValue(term) != entry.term else { return }
        Task {
            if let saved = await editor.save(term: term, aliases: entry.aliases) {
                term = saved.term
            }
        }
    }
}
