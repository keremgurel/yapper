import SwiftUI

/// The compiled context, behind a fold, for the creator who wants to check it.
struct BrainWhatYapperReads: View {
    @ObservedObject private var store = BrainPreviewStore.shared
    @State private var open = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
            Button {
                open.toggle()
                store.isOpen = open
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .semibold))
                        .rotationEffect(.degrees(open ? 90 : 0))
                    Text("What Yapper reads").font(.system(size: 13, weight: .medium))
                }
                .foregroundStyle(.secondary)
            }
            .buttonStyle(.studioPlain)
            if open { preview }
        }
        .onDisappear { store.isOpen = false }
        .onAppear { store.isOpen = open }
    }

    private var preview: some View {
        NativeSection(title: "What the AI reads") {
            Picker("Which kind of writing", selection: $store.surface) {
                ForEach(BrainSurface.previewOrder) { Text($0.previewLabel).tag($0) }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .fixedSize()
            .clickableCursor()
        } content: {
            if let preview = store.preview {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 12) {
                        BrainBudgetMeter(label: "Who you are", used: BrainPreview.length(preview.core), total: preview.budget.core, hint: "Read every single time.")
                        BrainBudgetMeter(label: "Listed, not read", used: BrainPreview.length(preview.index), total: preview.budget.index, hint: "One line each, so the AI knows these exist.")
                        BrainBudgetMeter(label: "Pulled in for this", used: BrainPreview.length(preview.loaded), total: preview.budget.loaded, hint: "Chosen per piece. This preview picks by keyword; the real call asks a model.")
                    }
                    let section = preview.section.trimmingCharacters(in: .whitespacesAndNewlines)
                    if section.isEmpty {
                        Text("Nothing yet. Every prompt runs exactly as it did before you had a brain.")
                            .font(.system(size: 13)).foregroundStyle(.secondary)
                    } else {
                        ScrollView {
                            Text(section)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(.primary.opacity(0.8))
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .frame(maxHeight: 384)
                        .nativeWell(padding: 12)
                    }
                }
                .opacity(store.fetching ? 0.6 : 1)
            } else if store.failed {
                Text("Could not compile a preview just now.").font(.system(size: 13)).foregroundStyle(.secondary)
            } else {
                NativeLoadingState(label: "Compiling…")
            }
        }
    }
}

/// How much of a surface's allowance one part of the Brain is using. Turns
/// yellow past four fifths, where the next thing added costs something else
/// its place.
struct BrainBudgetMeter: View {
    let label: String
    let used: Int
    let total: Int
    let hint: String

    var body: some View {
        let share = total > 0 ? min(1, Double(used) / Double(total)) : 0
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(label).font(.nativeLabel).foregroundStyle(.secondary)
                Spacer()
                Text("\(used) / \(total)").font(.system(size: 12, design: .monospaced)).foregroundStyle(.secondary)
            }
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.studioFaintFill)
                    Capsule()
                        .fill(share > 0.8 ? NativeChip.Tone.yellow.color : NativeChip.Tone.cyan.color)
                        .frame(width: geometry.size.width * share)
                }
            }
            .frame(height: 4)
            Text(hint).font(.system(size: 12)).foregroundStyle(.secondary)
        }
    }
}
