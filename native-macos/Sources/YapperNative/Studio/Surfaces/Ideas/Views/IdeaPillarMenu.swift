import SwiftUI

/// The inline pillar control: the pillar chip, opening the creator's pillars,
/// so an idea can be refiled without opening it.
struct IdeaPillarMenu: View {
    let row: IdeaItem
    @ObservedObject var pillars: IdeaPillarsStore = .shared
    @ObservedObject var changes: IdeaPillarChanges = .shared
    @State private var open = false

    var body: some View {
        Button { open.toggle() } label: {
            HStack(spacing: 3) {
                if let name = row.pillar, !name.isEmpty {
                    NativeChip(text: name, tone: IdeaPillarTone.tone(for: name), dot: true)
                } else {
                    Text("Add pillar").font(.system(size: 12)).foregroundStyle(.secondary)
                }
                Image(systemName: "chevron.down").font(.system(size: 9, weight: .medium)).foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.studioPlain)
        .accessibilityLabel("Pillar: \(row.pillar ?? "none")")
        .popover(isPresented: $open, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: 2) {
                ForEach(pillars.pillars) { pillar in
                    option(pillar.name, selected: row.pillarId == pillar.id) {
                        changes.change(row.id, to: pillar)
                    }
                }
                if row.pillarId != nil || row.pillar != nil {
                    Rectangle().fill(Color.studioLine).frame(height: 1).padding(.vertical, 2)
                    option("No pillar", selected: false) { changes.change(row.id, to: nil) }
                }
                if pillars.pillars.isEmpty {
                    Text("Add pillars in Brain first.").font(.system(size: 12)).foregroundStyle(.secondary).padding(8)
                }
            }
            .padding(4)
            .frame(width: 220)
            .task { if pillars.pillars.isEmpty { await pillars.refresh() } }
        }
    }

    private func option(_ name: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            open = false
            if !selected { action() }
        } label: {
            HStack(spacing: 8) {
                Circle().fill(IdeaPillarTone.tone(for: name).color).frame(width: 6, height: 6)
                Text(name).font(.system(size: 13, weight: .medium)).lineLimit(1)
                Spacer(minLength: 12)
                if selected { Image(systemName: "checkmark").font(.system(size: 11, weight: .semibold)) }
            }
            .padding(.horizontal, 8).padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(IdeaMenuRowStyle())
    }
}
