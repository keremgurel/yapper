import SwiftUI

/// The mishearings corrected to one spelling: a chip each, click to stop
/// correcting it, and a field to add another.
struct DictionaryAliasStrip: View {
    let entry: DictionaryEntry
    @ObservedObject var editor: DictionaryRowEditor
    /// The spelling as currently typed, so adding a mishearing never throws
    /// away an unsaved spelling edit.
    let term: String
    @State private var alias = ""

    var body: some View {
        DictionaryFlowLayout(spacing: 8) {
            Text("Correct these")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
                .padding(.trailing, 2)
            ForEach(entry.aliases, id: \.self) { item in
                chip(item)
            }
            addField
        }
    }

    private func chip(_ item: String) -> some View {
        Button {
            Task { await editor.save(term: term, aliases: entry.aliases.filter { $0 != item }) }
        } label: {
            HStack(spacing: 4) {
                Text(item).font(.system(size: 12, weight: .medium))
                Image(systemName: "xmark").font(.system(size: 9, weight: .semibold))
            }
            .foregroundStyle(Color.primary.opacity(0.78))
            .padding(.horizontal, 10)
            .frame(height: 26)
            .background(Capsule().fill(Color.raisedBackground))
            .overlay(Capsule().strokeBorder(Color.studioLine, lineWidth: 1))
        }
        .buttonStyle(.studioPlain)
        .disabled(editor.saving)
        .help("Stop correcting \u{201C}\(item)\u{201D}")
    }

    private var addField: some View {
        HStack(spacing: 6) {
            TextField(entry.aliases.isEmpty ? "e.g. Salpip" : "Add another mishearing", text: $alias)
                .textFieldStyle(NativeTextFieldStyle(size: 12))
                .frame(minWidth: 170, maxWidth: 260)
                .onSubmit(add)
            Button(action: add) {
                Label("Add", systemImage: "plus")
            }
            .buttonStyle(EditorGhostButtonStyle(size: .small))
            .disabled(alias.trimmingCharacters(in: .whitespaces).isEmpty || editor.saving)
        }
        .disabled(editor.saving)
    }

    private func add() {
        let next = alias.trimmingCharacters(in: .whitespaces)
        guard !next.isEmpty else { return }
        Task {
            if await editor.save(term: term, aliases: entry.aliases + [next]) != nil {
                alias = ""
            }
        }
    }
}
