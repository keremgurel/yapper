import SwiftUI

/// One way in, three doors: write a section, paste anything, or import a
/// file. Paste and file land on the same editable preview and become the
/// same kind of section.
struct BrainAddContextSheet: View {
    enum Mode: String, CaseIterable, Identifiable {
        case write = "Write it", paste = "Paste anything", file = "Import a file"
        var id: String { rawValue }
    }

    let onClose: () -> Void

    @ObservedObject private var blocks = BrainBlocksStore.shared
    @StateObject private var ingest = BrainIngestStore()
    @State private var mode: Mode = .write
    @State private var saving = false
    @State private var saveError: String?

    var body: some View {
        BrainSheetFrame(
            title: "Add context",
            description: "Anything you know that should shape what gets written. There is no fixed set of things this can be.",
            onClose: onClose
        ) {
            Picker("How to add context", selection: $mode) {
                ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .fixedSize()
            .onChange(of: mode) { _, _ in ingest.reset() }

            switch mode {
            case .write:
                BrainWritePane(existingTitles: (blocks.blocks ?? []).map(\.title)) { block in
                    try await blocks.add(block)
                    onClose()
                }
            case .paste:
                BrainPastePane { ingest.fromText($0) }
            case .file:
                BrainFilePane { ingest.fromFile($0) }
            }

            failureNote

            if ingest.detected != nil {
                BrainProposalPreview(ingest: ingest, saving: saving, onSave: save)
            }
            if let saveError { BrainInlineError(message: saveError) }
        }
    }

    @ViewBuilder
    private var failureNote: some View {
        switch ingest.failure {
        case .fileTooLarge:
            BrainInlineError(message: "That file is too large to read here. Paste the part you need instead.")
        case .fileUnreadable:
            BrainInlineError(message: "That file couldn't be read as text. Paste its contents instead.")
        case .namingFailed(let message):
            Text("Could not come up with a name. \(message) Type one and it saves the same.")
                .font(.system(size: 12)).foregroundStyle(.secondary)
        case nil:
            EmptyView()
        }
    }

    private func save() {
        guard let block = ingest.newBlock, !saving else { return }
        saving = true
        saveError = nil
        Task {
            defer { saving = false }
            do {
                try await blocks.add(block)
                onClose()
            } catch {
                saveError = error.localizedDescription
            }
        }
    }
}
