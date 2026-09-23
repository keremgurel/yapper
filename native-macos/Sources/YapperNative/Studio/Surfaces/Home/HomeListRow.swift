import SwiftUI

/// A clickable list row: full-width hit area, a faint fill on hover, the
/// pointer. Used by Up next and Five for today.
struct HomeListRow<Content: View>: View {
    let action: () -> Void
    @ViewBuilder var content: () -> Content
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) { content() }
                .frame(maxWidth: .infinity, minHeight: 40, alignment: .leading)
                .padding(.horizontal, 8)
                .background(
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(hovering ? Color.studioFaintFill : Color.clear)
                )
        }
        .buttonStyle(.studioPlain)
        .onHover { hovering = $0 }
    }
}

/// Hairline-separated rows with no outer box.
struct HomeDividedList<Item: Identifiable, Row: View>: View {
    let items: [Item]
    @ViewBuilder var row: (Item) -> Row

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                if index > 0 { Rectangle().fill(Color.studioLine).frame(height: 1).padding(.horizontal, 8) }
                row(item)
            }
        }
    }
}

/// Grey bars in the shape of the rows that are loading.
struct HomeRowSkeleton: View {
    var rows = 3
    var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<rows, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 6).fill(Color.studioFaintFill).frame(height: 36)
            }
        }
    }
}
