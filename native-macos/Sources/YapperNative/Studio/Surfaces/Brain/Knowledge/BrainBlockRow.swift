import SwiftUI

/// A section as a row: what it is called, what it is for, how much of it the
/// AI reads, and how big it is. Opens in place, so whatever it was being
/// compared against stays on screen.
struct BrainBlockRow: View {
    let block: BrainBlock
    let open: Bool
    let canReorder: Bool
    let position: Int
    let total: Int
    @ObservedObject var store: BrainBlocksStore
    let onToggle: () -> Void

    @State private var hovering = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                reorderControls
                Button(action: onToggle) {
                    HStack(spacing: 10) {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .semibold))
                            .rotationEffect(.degrees(open ? 90 : 0))
                            .foregroundStyle(.secondary)
                        Image(systemName: block.kind.symbol).font(.system(size: 13)).foregroundStyle(.secondary).frame(width: 16)
                        Text(block.title.isEmpty ? "Untitled" : block.title)
                            .font(.system(size: 14, weight: .medium)).lineLimit(1).layoutPriority(1)
                        Text(block.digest.isEmpty ? block.shapeDescription : block.digest)
                            .font(.system(size: 13)).foregroundStyle(.secondary).lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.studioPlain)
                Text(block.sizeLabel)
                    .font(.system(size: 12, design: .monospaced)).foregroundStyle(.secondary)
                BrainUsageMenu(usage: block.usage) { store.edit(block.id, .usage($0)) }
                BrainConfirmDeleteButton(
                    label: "Delete \(block.title.isEmpty ? "section" : block.title)",
                    busy: store.removing.contains(block.id)
                ) { Task { await store.remove(block.id) } }
                .opacity(hovering || open ? 1 : 0.35)
            }
            .padding(.horizontal, 10)
            .background(hovering ? Color.studioFaintFill.opacity(0.5) : .clear)
            .onHover { hovering = $0 }
            .contextMenu {
                Button("Move up") { Task { await store.move(block.id, by: -1) } }.disabled(!canReorder || position == 0)
                Button("Move down") { Task { await store.move(block.id, by: 1) } }.disabled(!canReorder || position >= total - 1)
            }

            if open {
                BrainBlockEditor(block: block) { store.edit(block.id, $0) }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
            }
        }
    }

    @ViewBuilder
    private var reorderControls: some View {
        VStack(spacing: 0) {
            arrow("chevron.up", enabled: canReorder && position > 0, label: "Move up") {
                Task { await store.move(block.id, by: -1) }
            }
            arrow("chevron.down", enabled: canReorder && position < total - 1, label: "Move down") {
                Task { await store.move(block.id, by: 1) }
            }
        }
        .opacity(hovering && canReorder ? 1 : 0)
    }

    private func arrow(_ symbol: String, enabled: Bool, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 9, weight: .semibold)).frame(width: 16, height: 12)
        }
        .buttonStyle(.studioPlain)
        .foregroundStyle(.secondary)
        .disabled(!enabled)
        .accessibilityLabel(label)
    }
}

/// Choosing how much of a section reaches a prompt. A menu, not a toggle,
/// because there are four answers and each needs its line of help.
struct BrainUsageMenu: View {
    let usage: BrainBlockUsage
    let onChange: (BrainBlockUsage) -> Void

    @State private var open = false

    var body: some View {
        Button { open.toggle() } label: {
            HStack(spacing: 3) {
                NativeChip(text: usage.label, tone: usage.tone)
                Image(systemName: "chevron.down").font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.studioPlain)
        .accessibilityLabel("How this is read: \(usage.label)")
        .popover(isPresented: $open, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(BrainBlockUsage.allCases, id: \.self) { level in
                    BrainMenuRow(checked: level == usage, title: level.label, help: level.help) {
                        open = false
                        onChange(level)
                    }
                }
            }
            .padding(6)
            .frame(width: 300)
        }
    }
}
