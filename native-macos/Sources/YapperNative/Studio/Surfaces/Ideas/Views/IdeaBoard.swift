import SwiftUI

/// The list as columns. Cards can be dragged only when grouped by status,
/// the one axis where moving a card means one clear thing: advance it.
struct IdeaBoard: View {
    let rows: [IdeaItem]
    let grouping: ViewGrouping?
    let onOpen: (String) -> Void
    let onStatus: (IdeaItem, IdeaStatus) -> Void
    @State private var target: String?

    private var effectiveGrouping: ViewGrouping { grouping ?? .status }
    private var canDrag: Bool { effectiveGrouping == .status }

    var body: some View {
        ScrollView(.horizontal) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(IdeaGrouping.groups(rows, by: effectiveGrouping)) { group in
                    column(group)
                }
            }
            .padding(.bottom, 12)
        }
    }

    private func column(_ group: IdeaGroup) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                if let status = group.status { Circle().fill(status.tone.color).frame(width: 6, height: 6) }
                Text(group.label).font(.system(size: 12, weight: .semibold)).foregroundStyle(.secondary)
                Text("\(group.items.count)").font(.system(size: 12).monospacedDigit()).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 6).padding(.top, 4)

            ForEach(group.items) { row in
                IdeaBoardCard(row: row) { onOpen(row.id) }
                    .modifier(IdeaDragSource(enabled: canDrag, id: row.id))
            }
            if group.items.isEmpty {
                Text(canDrag ? "Nothing here. Drag a card here to move it." : "Nothing here")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity).padding(.vertical, 20)
            }
        }
        .padding(8)
        .frame(width: 264, alignment: .top)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.studioInputBackground))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(target == group.id && canDrag ? Color.yapperOrange : Color.clear, lineWidth: 2)
        }
        .dropDestination(for: String.self) { ids, _ in
            guard canDrag, let status = group.status, let id = ids.first, let row = rows.first(where: { $0.id == id }) else { return false }
            if row.status != status.rawValue { onStatus(row, status) }
            return true
        } isTargeted: { over in
            if over { target = group.id } else if target == group.id { target = nil }
        }
    }
}

private struct IdeaDragSource: ViewModifier {
    let enabled: Bool
    let id: String

    func body(content: Content) -> some View {
        if enabled { content.draggable(id) } else { content }
    }
}

/// One idea as a board card: what it is, what it ships as, and how long the
/// script runs.
struct IdeaBoardCard: View {
    let row: IdeaItem
    let onOpen: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 8) {
                Text(row.title.isEmpty ? "Untitled" : row.title)
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                if row.pillar != nil || !row.formats.isEmpty {
                    IdeaChipFlow(spacing: 4) {
                        if let pillar = row.pillar { NativeChip(text: pillar, tone: IdeaPillarTone.tone(for: pillar), dot: true) }
                        ForEach(IdeaFormat.all.filter { row.formats.contains($0.id) }) { NativeChip(text: $0.label, tone: $0.tone) }
                    }
                }
                if let meter = IdeaScriptMeter.label(row.script) {
                    Label("~\(meter)", systemImage: "doc.text")
                        .font(.system(size: 11).monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background {
                let shape = RoundedRectangle(cornerRadius: 10, style: .continuous)
                shape.fill(Color.panelBackground)
                    .overlay { shape.strokeBorder(hovering ? Color.studioLineStrong : Color.studioLine, lineWidth: 1) }
            }
        }
        .buttonStyle(.studioPlain)
        .onHover { hovering = $0 }
    }
}

/// How long a script takes to say at 145 words a minute: "48s" or "1:12".
enum IdeaScriptMeter {
    static func label(_ script: String?) -> String? {
        let words = (script ?? "").split(whereSeparator: \.isWhitespace).count
        guard words > 0 else { return nil }
        let seconds = Int((Double(words) / 145 * 60).rounded())
        return seconds < 60 ? "\(seconds)s" : seconds.dictationClock
    }
}
