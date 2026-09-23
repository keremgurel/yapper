import SwiftUI

/// The list as a table: select boxes, sortable headers, optional group
/// sections, one row per idea. Scrolls sideways when the window is narrower
/// than the columns need.
struct IdeaTable: View {
    let rows: [IdeaItem]
    let grouping: ViewGrouping?
    let columns: [IdeaColumn]
    @Binding var sort: IdeaSort
    @ObservedObject var selection: IdeaSelection
    let onOpen: (String) -> Void
    let onStatus: (IdeaItem, IdeaStatus) -> Void

    var body: some View {
        ScrollView(.horizontal) {
            VStack(spacing: 0) {
                header
                if rows.isEmpty {
                    NativeEmptyState(systemImage: "line.3.horizontal.decrease", title: "Nothing matches those filters.")
                } else {
                    ForEach(IdeaGrouping.groups(rows, by: grouping).filter { !$0.items.isEmpty }) { group in
                        if grouping != nil { sectionHeader(group) }
                        ForEach(group.items) { row in
                            IdeaTableRow(
                                row: row,
                                columns: columns,
                                selected: selection.ids.contains(row.id),
                                onToggle: { selection.toggle(row.id) },
                                onOpen: { onOpen(row.id) },
                                onStatus: { onStatus(row, $0) }
                            )
                        }
                    }
                }
            }
            .containerRelativeFrame(.horizontal) { width, _ in max(width, IdeaColumn.minimumWidth(columns)) }
            .background(NativeCardBackground())
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .scrollIndicators(.automatic)
    }

    private var header: some View {
        let all = !rows.isEmpty && rows.allSatisfy { selection.ids.contains($0.id) }
        let some = rows.contains { selection.ids.contains($0.id) }
        return HStack(spacing: 12) {
            IdeaCheckbox(mark: all ? .on : (some ? .mixed : .off)) {
                selection.select(all ? [] : rows.map(\.id))
            }
            .disabled(rows.isEmpty)
            ForEach(columns) { column in
                headerCell(column).ideaColumnFrame(column)
            }
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 40)
        .background(Color.studioInputBackground)
        .overlay(alignment: .bottom) { Rectangle().fill(Color.studioLine).frame(height: 1) }
    }

    @ViewBuilder
    private func headerCell(_ column: IdeaColumn) -> some View {
        if let key = column.sortKey {
            Button { sort.toggle(key) } label: {
                HStack(spacing: 4) {
                    Text(column.label)
                    if sort.key == key {
                        Image(systemName: sort.ascending ? "chevron.up" : "chevron.down").font(.system(size: 9, weight: .semibold))
                    }
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(sort.key == key ? Color.primary : Color.secondary)
            }
            .buttonStyle(.studioPlain)
        } else {
            Text(column.label).font(.system(size: 12, weight: .semibold)).foregroundStyle(.secondary)
        }
    }

    private func sectionHeader(_ group: IdeaGroup) -> some View {
        HStack(spacing: 8) {
            Text(group.label).font(.system(size: 12, weight: .semibold))
            Text("\(group.items.count)").font(.system(size: 12).monospacedDigit())
            Spacer()
        }
        .foregroundStyle(.secondary)
        .padding(.horizontal, 16).padding(.vertical, 8)
        .background(Color.studioFaintFill)
        .overlay(alignment: .bottom) { Rectangle().fill(Color.studioLine).frame(height: 1) }
    }
}

/// One idea as a table row. Clicking anywhere but a control opens it.
struct IdeaTableRow: View {
    let row: IdeaItem
    let columns: [IdeaColumn]
    let selected: Bool
    let onToggle: () -> Void
    let onOpen: () -> Void
    let onStatus: (IdeaStatus) -> Void
    @State private var hovering = false

    var body: some View {
        HStack(spacing: 12) {
            IdeaCheckbox(mark: selected ? .on : .off, action: onToggle)
            ForEach(columns) { column in
                IdeaCell(column: column, row: row, onStatus: onStatus).ideaColumnFrame(column)
            }
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .background(selected ? Color.studioSelectedFill : (hovering ? Color.studioFaintFill : Color.clear))
        .overlay(alignment: .bottom) { Rectangle().fill(Color.studioLine).frame(height: 1) }
        .contentShape(Rectangle())
        .onTapGesture(perform: onOpen)
        .onHover { hovering = $0 }
        .clickableCursor()
    }
}

extension View {
    /// Fixed width for a column, or the slack for the title.
    @ViewBuilder
    func ideaColumnFrame(_ column: IdeaColumn) -> some View {
        if let width = column.width {
            frame(width: width, alignment: column == .actions ? .trailing : .leading)
        } else {
            frame(minWidth: 220, maxWidth: .infinity, alignment: .leading)
        }
    }
}
