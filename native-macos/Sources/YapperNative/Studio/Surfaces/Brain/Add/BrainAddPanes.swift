import SwiftUI
import UniformTypeIdentifiers

/// Naming a section first: a section called "Why I post" is a question the
/// creator can answer, and an untitled box is one they close.
struct BrainWritePane: View {
    let existingTitles: [String]
    let onAdd: (NewBrainBlock) async throws -> Void

    @State private var title = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                TextField("Call it whatever you call it", text: $title)
                    .textFieldStyle(.native)
                    .onSubmit { add(NewBrainBlock(title: title)) }
                Button("Add") { add(NewBrainBlock(title: title)) }
                    .buttonStyle(EditorPrimaryButtonStyle())
                    .disabled(busy || title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            if !starters.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Or start from one of these").font(.system(size: 12)).foregroundStyle(.secondary)
                    BrainFlowLayout {
                        ForEach(starters, id: \.title) { starter in
                            Button { add(starter) } label: {
                                Text(starter.title)
                                    .font(.system(size: 12))
                                    .padding(.horizontal, 10).padding(.vertical, 4)
                                    .overlay(Capsule().strokeBorder(Color.studioLine))
                            }
                            .buttonStyle(.studioPlain)
                            .disabled(busy)
                        }
                    }
                }
            }
            if let error { BrainInlineError(message: error) }
        }
    }

    private var starters: [NewBrainBlock] {
        let taken = Set(existingTitles.map { $0.trimmingCharacters(in: .whitespaces).lowercased() })
        return NewBrainBlock.starters.filter { !taken.contains($0.title.lowercased()) }
    }

    private func add(_ block: NewBrainBlock) {
        guard !busy, !block.title.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                try await onAdd(block)
                title = ""
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

/// The box you can put anything in. Read on this Mac, so nothing is uploaded
/// until it is saved.
struct BrainPastePane: View {
    let onText: (String) -> Void
    @State private var text = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            NativeTextArea(
                text: $text,
                placeholder: "Paste a list, a spreadsheet, a research doc, a transcript. Anything.",
                font: .system(size: 13, design: .monospaced),
                minHeight: 200
            )
            .onChange(of: text) { _, value in onText(value) }
            Text("Read on this Mac, so nothing is uploaded until you save it.")
                .font(.system(size: 11)).foregroundStyle(.secondary)
        }
    }
}

/// A file, read where it sits. Drop one on the well or choose one.
struct BrainFilePane: View {
    let onFile: (URL) -> Void

    @State private var name: String?
    @State private var over = false

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "arrow.up.doc")
                .font(.system(size: 17)).foregroundStyle(.secondary)
                .frame(width: 40, height: 40)
                .background(Circle().fill(Color.panelBackground))
            Text(name ?? "Drop a file, or choose one").font(.system(size: 13, weight: .semibold))
            Text("\(BrainIngestStore.importableExtensions.map { ".\($0)" }.joined(separator: ", ")), up to 2 MB.")
                .font(.system(size: 12)).foregroundStyle(.secondary)
            Button("Choose a file") {
                if let url = BrainFilePicker.chooseTextFile() { take(url) }
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(over ? Color.studioSelectedFill : Color.studioInputBackground))
        .onDrop(of: [.fileURL], isTargeted: $over) { providers in
            guard let provider = providers.first else { return false }
            _ = provider.loadObject(ofClass: URL.self) { url, _ in
                guard let url else { return }
                Task { @MainActor in take(url) }
            }
            return true
        }
    }

    private func take(_ url: URL) {
        name = url.lastPathComponent
        onFile(url)
    }
}
