import SwiftUI

/// What was parsed, before anything is saved. Naming is a separate button
/// because it is the only step that costs a credit.
struct BrainProposalPreview: View {
    @ObservedObject var ingest: BrainIngestStore
    let saving: Bool
    let onSave: () -> Void

    @State private var tagsText = ""

    var body: some View {
        if let detected = ingest.detected {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        NativeChip(text: detected.kind.rawValue, tone: .cyan)
                        Text(detected.shape).font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    ScrollView {
                        Text(String(detected.sample.prefix(1200)))
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(.primary.opacity(0.8))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(maxHeight: 160)
                }
                .nativeWell(padding: 12)

                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .bottom) {
                        Text("Call it").font(.nativeLabel).foregroundStyle(.secondary)
                        Spacer()
                        Button {
                            Task { await ingest.nameIt() }
                        } label: {
                            HStack(spacing: 5) {
                                if ingest.naming { ProgressView().controlSize(.mini) } else { Image(systemName: "sparkles") }
                                Text("Name it for me")
                            }
                        }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                        .disabled(ingest.naming)
                    }
                    TextField("Content gaps from TikTok search", text: $ingest.proposal.title)
                        .textFieldStyle(.native)
                }

                NativeField(label: "What it is, in one line") {
                    TextField("Search terms with thin answers, use when picking a topic", text: $ingest.proposal.digest)
                        .textFieldStyle(.native)
                }

                NativeField(label: "Tags") {
                    TextField("pricing, gaps", text: $tagsText)
                        .textFieldStyle(.native)
                        .onChange(of: tagsText) { _, value in ingest.proposal.tags = brainParseTags(value, limit: 4) }
                }

                HStack(spacing: 12) {
                    Text("Read it").font(.nativeLabel).foregroundStyle(.secondary)
                    BrainUsageMenu(usage: ingest.proposal.usage) { ingest.proposal.usage = $0 }
                    Spacer()
                    Button {
                        onSave()
                    } label: {
                        HStack(spacing: 6) {
                            if saving { ProgressView().controlSize(.mini) }
                            Text("Add to brain")
                        }
                    }
                    .buttonStyle(EditorPrimaryButtonStyle())
                    .disabled(saving || ingest.proposal.title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onChange(of: ingest.proposal.tags) { _, tags in
                // A suggested name brings its own tags; show them.
                if brainParseTags(tagsText, limit: 4) != tags { tagsText = tags.joined(separator: ", ") }
            }
        }
    }
}
