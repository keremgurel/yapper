import SwiftUI

/// Hashtags as removable chips. Space, comma or Return commits what is typed.
struct PosterHashtagEditor: View {
    let tags: [String]
    let min: Int
    let max: Int
    let onChange: ([String]) -> Void
    @State private var typing = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            PosterFlowLayout(spacing: 6) {
                ForEach(tags, id: \.self) { tag in
                    Button { onChange(tags.filter { $0 != tag }) } label: {
                        HStack(spacing: 4) {
                            Text("#\(tag)")
                            Image(systemName: "xmark").font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
                        }
                        .font(.system(size: 12, weight: .medium))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Capsule().fill(Color.studioFaintFill))
                    }
                    .buttonStyle(.studioPlain)
                    .help("Remove #\(tag)")
                }
                TextField("Add hashtag", text: $typing)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                    .frame(width: 110)
                    .onSubmit(commit)
                    .onChange(of: typing) { _, value in
                        if value.contains(" ") || value.contains(",") { commit() }
                    }
            }
            Text("\(tags.count) \(tags.count == 1 ? "hashtag" : "hashtags"). \(min) to \(max) suits this platform.")
                .font(.system(size: 11)).foregroundStyle(.secondary)
        }
    }

    private func commit() {
        guard !typing.trimmingCharacters(in: .whitespaces).isEmpty else { typing = ""; return }
        onChange(PosterHashtags.add(typing, to: tags))
        typing = ""
    }
}

/// Wraps its children onto as many lines as they need.
struct PosterFlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.last.map { $0.y + $0.height } ?? 0
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: bounds.minY + row.y + (row.height - size.height) / 2), proposal: .unspecified)
                x += size.width + spacing
            }
        }
    }

    private struct Row { var indices: [Int] = []; var y: CGFloat = 0; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func arrange(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = [Row()]
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            var row = rows[rows.count - 1]
            if !row.indices.isEmpty && row.width + spacing + size.width > width {
                let y = row.y + row.height + spacing
                rows.append(Row(y: y))
                row = rows[rows.count - 1]
            }
            row.width += (row.indices.isEmpty ? 0 : spacing) + size.width
            row.height = Swift.max(row.height, size.height)
            row.indices.append(index)
            rows[rows.count - 1] = row
        }
        return rows
    }
}
