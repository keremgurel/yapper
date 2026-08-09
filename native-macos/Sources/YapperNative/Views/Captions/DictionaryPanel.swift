import SwiftUI

/// The words the transcriber keeps getting wrong, and how the creator spells
/// them.
///
/// Saved against the account, so a name learned here is spelled the same way in
/// the browser, and listened for the next time anything is transcribed.
struct DictionaryPanel: View {
    @ObservedObject var session: EditorSession
    @State private var newTerm = ""

    private var entries: [DictionaryEntry] { session.dictionaryEntries }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header

            if let suggestion = session.dictionarySuggestion {
                DictionarySuggestionRow(session: session, correction: suggestion)
            }

            addRow

            if entries.isEmpty {
                Text("Nothing saved yet. Add a name, a brand or a piece of jargon and it will be spelled your way from the next transcript on.")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                        if index > 0 { Divider().opacity(0.4) }
                        DictionaryRow(session: session, entry: entry)
                    }
                }
                .background(Color.studioInputBackground.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .strokeBorder(Color.studioLine, lineWidth: 1)
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Dictionary")
                .font(.studioBodyStrong)
            Text("Spellings the transcriber should use, and what it usually hears instead")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var addRow: some View {
        HStack(spacing: 8) {
            TextField("Preferred spelling", text: $newTerm)
                .textFieldStyle(.plain)
                .font(.studioBody)
                .padding(.horizontal, 9)
                .frame(height: 26)
                .background(Color.studioInputBackground)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .onSubmit(add)

            Button("Add", action: add)
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                .disabled(TranscriptionDictionary.key(newTerm).isEmpty)
        }
    }

    private func add() {
        let term = newTerm
        guard !TranscriptionDictionary.key(term).isEmpty else { return }
        newTerm = ""
        Task { await session.addDictionaryTerm(term) }
    }
}

/// "You changed Celpip to CELPIP. Remember that?"
private struct DictionarySuggestionRow: View {
    @ObservedObject var session: EditorSession
    let correction: CaptionCorrection

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: "sparkles")
                .foregroundStyle(Color.yapperOrange)
            VStack(alignment: .leading, spacing: 1) {
                Text("Always spell “\(correction.heard)” as “\(correction.term)”?")
                    .font(.studioCaptionStrong)
                Text("Applies to everything transcribed from now on")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 6)
            Button("Remember") {
                Task { await session.acceptDictionarySuggestion() }
            }
            .buttonStyle(EditorPrimaryButtonStyle(size: .mini))
            Button {
                session.dismissDictionarySuggestion()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.studioPlain)
        .clickableCursor()
        }
        .padding(9)
        .background(Color.yapperOrange.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
    }
}

private struct DictionaryRow: View {
    @ObservedObject var session: EditorSession
    let entry: DictionaryEntry
    @State private var newAlias = ""
    @State private var isAddingAlias = false

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 8) {
                Text(entry.term)
                    .font(.studioBodyStrong)
                    .lineLimit(1)

                Spacer(minLength: 4)

                Button {
                    isAddingAlias.toggle()
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.studioPlain)
        .clickableCursor()
                .help("Add something the transcriber hears instead")

                Button {
                    Task { await session.removeDictionaryEntry(entry) }
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.studioPlain)
        .clickableCursor()
                .help("Remove this spelling")
            }

            if !entry.aliases.isEmpty {
                HStack(spacing: 5) {
                    ForEach(entry.aliases, id: \.self) { alias in
                        AliasChip(alias: alias) {
                            Task { await session.removeDictionaryAlias(alias, from: entry) }
                        }
                    }
                }
            }

            if isAddingAlias {
                HStack(spacing: 7) {
                    TextField("Heard as…", text: $newAlias)
                        .textFieldStyle(.plain)
                        .font(.studioCaption)
                        .padding(.horizontal, 7)
                        .frame(height: 22)
                        .background(Color.studioInputBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                        .onSubmit(addAlias)
                    Button("Save", action: addAlias)
                        .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                        .disabled(TranscriptionDictionary.key(newAlias).isEmpty)
                }
            }
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 7)
    }

    private func addAlias() {
        let alias = newAlias
        guard !TranscriptionDictionary.key(alias).isEmpty else { return }
        newAlias = ""
        isAddingAlias = false
        Task { await session.addDictionaryAlias(alias, to: entry) }
    }
}

private struct AliasChip: View {
    let alias: String
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Text(alias)
                .font(.studioCaption)
                .foregroundStyle(.secondary)
            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.studioPlain)
        .clickableCursor()
        }
        .padding(.horizontal, 7)
        .frame(height: 18)
        .background(Color.studioFaintFill)
        .clipShape(Capsule())
    }
}
