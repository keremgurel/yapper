import SwiftUI

/// Set the Brain up from one document: paste or choose it, read it once,
/// review what it would write, then apply. Nothing lands until Apply.
struct BrainSetupSheet: View {
    let onClose: () -> Void

    @ObservedObject private var project = BrainProjectStore.shared
    @ObservedObject private var blocks = BrainBlocksStore.shared
    @StateObject private var setup = BrainSetupStore()

    var body: some View {
        BrainSheetFrame(
            title: "Set up from a document",
            description: "Drop in the document that describes your content system. It fills every Essentials field, your pillars, and the Knowledge worth keeping, and you review each part before it lands.",
            closeDisabled: setup.applying,
            onClose: onClose
        ) {
            if setup.proposal == nil { documentStep }
            failure
            if let proposal = setup.proposal, setup.selection != nil {
                BrainSetupReview(
                    proposal: proposal,
                    selection: Binding(get: { setup.selection ?? .everything(in: proposal, existingPillars: 0) }, set: { setup.selection = $0 }),
                    project: project.project,
                    existingPillars: project.pillars.count,
                    onEditEssential: setup.editEssential
                )
            }
        } footer: {
            BrainSheetFooter {
                HStack(spacing: 8) {
                    if setup.proposal == nil {
                        Button("Choose a file") {
                            if let url = BrainFilePicker.chooseTextFile() { setup.loadFile(url) }
                        }
                        .buttonStyle(EditorSecondaryButtonStyle())
                        Spacer()
                        Button {
                            Task { await setup.extract(existingPillars: project.pillars.count) }
                        } label: {
                            HStack(spacing: 6) {
                                if setup.extracting { ProgressView().controlSize(.mini) } else { Image(systemName: "sparkles") }
                                Text("Read it \u{00B7} 1 credit")
                            }
                        }
                        .buttonStyle(EditorPrimaryButtonStyle())
                        .disabled(!setup.canExtract)
                    } else {
                        Spacer()
                        Button("Start over") { setup.startOver() }
                            .buttonStyle(EditorGhostButtonStyle(size: .regular))
                            .disabled(setup.applying)
                        Button {
                            Task { if await setup.apply(project: project, blocks: blocks) { onClose() } }
                        } label: {
                            HStack(spacing: 6) {
                                if setup.applying { ProgressView().controlSize(.mini) }
                                Text("Apply to my Brain")
                            }
                        }
                        .buttonStyle(EditorPrimaryButtonStyle())
                        .disabled(setup.applying || project.project == nil)
                    }
                }
            }
        }
    }

    private var documentStep: some View {
        NativeTextArea(
            text: $setup.document,
            placeholder: "Paste the whole thing here…",
            font: .system(size: 13),
            minHeight: 280
        )
        .disabled(setup.extracting)
    }

    @ViewBuilder
    private var failure: some View {
        switch setup.failure {
        case .file(let message), .extract(let message):
            BrainInlineError(message: message)
        case .apply:
            BrainInlineError(message: "Some of it couldn't be saved. Check your Brain, then apply the rest again.")
        case nil:
            EmptyView()
        }
    }
}
