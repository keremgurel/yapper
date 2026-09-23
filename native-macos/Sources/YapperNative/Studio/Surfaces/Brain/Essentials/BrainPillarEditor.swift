import SwiftUI

/// The pillar list: add, rename, describe, reorder, delete. Owns only which
/// rows are open; every change goes back through the one autosave.
struct BrainPillarEditor: View {
    let pillars: [BrainPillarDraft]
    let onChange: ([BrainPillarDraft]) -> Void

    @State private var open: Set<UUID> = []

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if pillars.isEmpty {
                Text("No pillars yet. Add the handful of angles you post about.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
            } else {
                VStack(spacing: 8) {
                    ForEach(Array(pillars.enumerated()), id: \.element.id) { index, pillar in
                        BrainPillarRow(
                            pillar: pillar,
                            open: open.contains(pillar.id),
                            canMoveUp: index > 0,
                            canMoveDown: index < pillars.count - 1,
                            onToggle: { toggle(pillar.id) },
                            onChange: { next in onChange(pillars.map { $0.id == pillar.id ? next : $0 }) },
                            onRemove: { onChange(pillars.filter { $0.id != pillar.id }) },
                            onMove: { move(from: index, by: $0) }
                        )
                    }
                }
            }
            Button {
                let pillar = BrainPillarDraft()
                open.insert(pillar.id)
                onChange(pillars + [pillar])
            } label: {
                Label("Add pillar", systemImage: "plus")
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        }
    }

    private func toggle(_ id: UUID) {
        if open.contains(id) { open.remove(id) } else { open.insert(id) }
    }

    private func move(from index: Int, by offset: Int) {
        let target = index + offset
        guard pillars.indices.contains(target) else { return }
        var next = pillars
        next.swapAt(index, target)
        onChange(next)
    }
}

/// One editable pillar: the name always visible, the description and example
/// angles behind a disclosure so a long list stays scannable.
struct BrainPillarRow: View {
    let pillar: BrainPillarDraft
    let open: Bool
    let canMoveUp: Bool
    let canMoveDown: Bool
    let onToggle: () -> Void
    let onChange: (BrainPillarDraft) -> Void
    let onRemove: () -> Void
    let onMove: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                VStack(spacing: 0) {
                    arrow("chevron.up", enabled: canMoveUp, label: "Move up") { onMove(-1) }
                    arrow("chevron.down", enabled: canMoveDown, label: "Move down") { onMove(1) }
                }
                TextField("Pillar name", text: binding(\.name))
                    .textFieldStyle(.plain)
                    .font(.system(size: 14, weight: .semibold))
                Button(action: onToggle) {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .rotationEffect(.degrees(open ? 180 : 0))
                        .foregroundStyle(.secondary)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.studioPlain)
                .help(open ? "Hide pillar detail" : "Show pillar detail")
                BrainConfirmDeleteButton(label: "Delete \(pillar.name.isEmpty ? "pillar" : pillar.name)", onConfirm: onRemove)
            }
            .padding(8)
            if open {
                Rectangle().fill(Color.studioLine).frame(height: 1)
                VStack(alignment: .leading, spacing: 8) {
                    NativeTextArea(text: binding(\.description), placeholder: "What belongs in this pillar, and what does not.", font: .system(size: 13), minHeight: 44)
                    NativeTextArea(
                        text: Binding(
                            get: { pillar.examples.joined(separator: "\n") },
                            set: { value in
                                var next = pillar
                                next.examples = value.components(separatedBy: "\n").map { String($0.drop(while: \.isWhitespace)) }
                                onChange(next)
                            }
                        ),
                        placeholder: "One example angle per line\nTask 5 in 60 seconds",
                        font: .system(size: 13),
                        minHeight: 44
                    )
                    Text("One example angle per line. These teach the AI the shape of the pillar, not just its name.")
                        .font(.system(size: 11)).foregroundStyle(.secondary)
                }
                .padding(12)
            }
        }
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.studioInputBackground))
    }

    private func binding(_ key: WritableKeyPath<BrainPillarDraft, String>) -> Binding<String> {
        Binding(get: { pillar[keyPath: key] }, set: { value in
            var next = pillar
            next[keyPath: key] = value
            onChange(next)
        })
    }

    private func arrow(_ symbol: String, enabled: Bool, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 9, weight: .semibold)).frame(width: 16, height: 12)
        }
        .buttonStyle(.studioPlain)
        .foregroundStyle(.secondary)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.3)
        .accessibilityLabel(label)
    }
}
