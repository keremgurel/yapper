import SwiftUI

/// The proposal, part by part: each Essentials field against what is there
/// now, the pillars, and the Knowledge worth keeping. Every part is optional.
struct BrainSetupReview: View {
    let proposal: BrainSetupProposal
    @Binding var selection: BrainSetupSelection
    let project: BrainProject?
    let existingPillars: Int
    let onEditEssential: (BrainSetupKey, String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            if !proposal.coveredKeys.isEmpty {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Essentials").font(.nativeLabel).foregroundStyle(.secondary)
                    ForEach(proposal.coveredKeys) { key in essentialRow(key) }
                }
            }
            if !proposal.pillars.isEmpty { pillars }
            if !proposal.blocks.isEmpty { blocks }
            if !proposal.notes.isEmpty {
                Text("Not covered: \(proposal.notes)").font(.system(size: 12)).foregroundStyle(.secondary)
            }
        }
    }

    private func essentialRow(_ key: BrainSetupKey) -> some View {
        let current = key.current(in: project)
        return VStack(alignment: .leading, spacing: 6) {
            BrainCheckRow(isOn: member(\.essentials, key.rawValue)) {
                Text(key.label).font(.nativeLabel)
            }
            Text(current.isEmpty ? "Now: empty" : "Now: \(current)")
                .font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(3)
            NativeTextArea(
                text: Binding(get: { proposal.essentials[key.rawValue] ?? "" }, set: { onEditEssential(key, $0) }),
                font: .system(size: 13),
                minHeight: 60
            )
            .disabled(!selection.essentials.contains(key.rawValue))
            .opacity(selection.essentials.contains(key.rawValue) ? 1 : 0.5)
        }
    }

    private var pillars: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Pillars").font(.nativeLabel).foregroundStyle(.secondary)
                Spacer()
                if existingPillars > 0 {
                    Picker("What to do with the current pillars", selection: $selection.pillarMode) {
                        Text("Replace the \(existingPillars) current").tag(BrainSetupSelection.PillarMode.replace)
                        Text("Add to them").tag(BrainSetupSelection.PillarMode.add)
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                    .fixedSize()
                }
            }
            ForEach(proposal.pillars, id: \.name) { pillar in
                BrainCheckRow(isOn: member(\.pillars, pillar.name)) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(pillar.name).font(.system(size: 13, weight: .semibold))
                        if !pillar.description.isEmpty {
                            Text(pillar.description).font(.system(size: 12)).foregroundStyle(.secondary)
                        }
                        if !pillar.examples.isEmpty {
                            Text("e.g. \(pillar.examples.joined(separator: " \u{00B7} "))")
                                .font(.system(size: 11)).foregroundStyle(.secondary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .nativeWell(padding: 12)
            }
        }
    }

    private var blocks: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Knowledge to add").font(.nativeLabel).foregroundStyle(.secondary)
            ForEach(proposal.blocks, id: \.title) { block in
                BrainCheckRow(isOn: member(\.blocks, block.title)) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 8) {
                            Text(block.title).font(.system(size: 13, weight: .medium))
                            if block.usage == "core" {
                                Text("read on every call").font(.system(size: 11)).foregroundStyle(.secondary)
                            }
                        }
                        Text(block.digest).font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    /// A checkbox binding for one member of one of the selection's sets.
    private func member(_ set: WritableKeyPath<BrainSetupSelection, Set<String>>, _ value: String) -> Binding<Bool> {
        Binding(
            get: { selection[keyPath: set].contains(value) },
            set: { on in
                if on { selection[keyPath: set].insert(value) } else { selection[keyPath: set].remove(value) }
            }
        )
    }
}
