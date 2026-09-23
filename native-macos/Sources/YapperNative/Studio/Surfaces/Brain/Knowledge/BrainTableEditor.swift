import SwiftUI

/// An imported grid, a page of rows at a time. Everything stays; only the
/// drawing is paged, so a five thousand row import still opens instantly.
struct BrainTableEditor: View {
    let table: BrainTable
    let onChange: (BrainTable) -> Void

    private static let page = 25
    @State private var shown = BrainTableEditor.page

    private let cellWidth: CGFloat = 160

    var body: some View {
        let visible = min(shown, table.rows.count)
        let remaining = table.rows.count - visible
        VStack(alignment: .leading, spacing: 8) {
            ScrollView(.horizontal) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 0) {
                        ForEach(table.columns.indices, id: \.self) { column in
                            cell(Binding(get: { table.columns[column] }, set: { setColumn(column, $0) }), header: true)
                        }
                        Color.clear.frame(width: 28)
                    }
                    .background(Color.studioFaintFill)
                    ForEach(0..<visible, id: \.self) { row in
                        Rectangle().fill(Color.studioLine).frame(height: 1)
                        HStack(spacing: 0) {
                            ForEach(table.columns.indices, id: \.self) { column in
                                cell(Binding(get: { value(row, column) }, set: { setCell(row, column, $0) }), header: false)
                            }
                            Button { removeRow(row) } label: {
                                Image(systemName: "xmark").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).frame(width: 28, height: 28)
                            }
                            .buttonStyle(.studioPlain)
                            .accessibilityLabel("Remove row \(row + 1)")
                        }
                    }
                }
            }
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color.studioLine))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            HStack(spacing: 12) {
                Text("\(table.rows.count) rows").font(.system(size: 12, design: .monospaced)).foregroundStyle(.secondary)
                if remaining > 0 {
                    Button("Show \(min(remaining, Self.page * 4)) more") { shown += Self.page * 4 }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                }
            }
        }
    }

    private func cell(_ text: Binding<String>, header: Bool) -> some View {
        TextField("", text: text)
            .textFieldStyle(.plain)
            .font(.system(size: header ? 12 : 13, weight: header ? .semibold : .regular))
            .foregroundStyle(header ? .secondary : .primary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(width: cellWidth, alignment: .leading)
    }

    private func value(_ row: Int, _ column: Int) -> String {
        guard table.rows.indices.contains(row), table.rows[row].indices.contains(column) else { return "" }
        return table.rows[row][column]
    }

    private func setColumn(_ index: Int, _ value: String) {
        var next = table
        next.columns[index] = value
        onChange(next)
    }

    private func setCell(_ row: Int, _ column: Int, _ value: String) {
        guard table.rows.indices.contains(row), table.rows[row].indices.contains(column) else { return }
        var next = table
        next.rows[row][column] = value
        onChange(next)
    }

    private func removeRow(_ row: Int) {
        guard table.rows.indices.contains(row) else { return }
        var next = table
        next.rows.remove(at: row)
        onChange(next)
    }
}
