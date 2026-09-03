import SwiftUI

/// The files an `@` is offering, as a list you can walk with the arrow keys.
///
/// It sits directly above the box rather than in a menu, because the point is to
/// keep typing: the list narrows under your hands and Return takes the top one.
///
/// Its height is worked out here and set exactly, from the room the caller says
/// it has. That room is the whole problem this list had: it hangs upward off the
/// top of the text box, the box sits at the foot of a floating panel, and a list
/// of a dozen files is taller than the panel and the window above it. It was not
/// showing four files because four was all there was — it was showing the last
/// four, with the rest of the list off the top of the window.
struct MentionSuggestionList: View {
    let files: [ProjectMedia]
    /// The row the keyboard is on.
    let active: Int
    /// How much room there is above the box, in points. Anything past it
    /// scrolls rather than disappearing off the top.
    let availableHeight: CGFloat
    let onPick: (ProjectMedia) -> Void
    let onHover: (Int) -> Void

    static let rowHeight: CGFloat = 28
    static let padding: CGFloat = 5
    /// Never fewer than this, even in a panel dragged down to nothing: a list
    /// you cannot see two rows of is not a list.
    static let minimumVisibleRows: CGFloat = 2
    /// And never more, however tall the window is. Past a dozen the list has
    /// stopped being something you read and started being something you search,
    /// and searching is what the letters after the `@` are for.
    private static let maximumVisibleRows: CGFloat = 12

    /// Exactly how tall the list will be, so a caller placing it above a box
    /// can offset by that and not by a guess.
    ///
    /// It has to be a number the caller can have, because the tidy way of
    /// saying "sit above this" — an alignment guide reading the overlay's own
    /// bottom edge — does not move it at all here. The list rendered straight
    /// down over the box you were typing into.
    static func height(fileCount: Int, availableHeight: CGFloat) -> CGFloat {
        let wanted = min(CGFloat(fileCount), maximumVisibleRows)
        let afforded = (availableHeight - 2 * padding) / rowHeight
        let rows = max(minimumVisibleRows, min(wanted, afforded.rounded(.down)))
        return rows * rowHeight + 2 * padding
    }

    private var height: CGFloat {
        Self.height(fileCount: files.count, availableHeight: availableHeight)
    }

    var body: some View {
        ScrollViewReader { scroller in
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(Array(files.enumerated()), id: \.element.id) { index, file in
                        row(file, index: index)
                            .id(file.id)
                    }
                }
                .padding(Self.padding)
            }
            .scrollBounceBehavior(.basedOnSize)
            .frame(height: height)
            // Walking off the bottom of what is showing has to bring the next
            // row into view, or the arrow keys stop meaning anything past row
            // nine.
            .onChange(of: active) { _, index in
                guard files.indices.contains(index) else { return }
                withAnimation(.easeOut(duration: 0.12)) { scroller.scrollTo(files[index].id) }
            }
        }
        .background(Color.raisedBackground)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(Color.studioLineStrong, lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.42), radius: 18, y: 8)
    }

    private func row(_ file: ProjectMedia, index: Int) -> some View {
        let isActive = index == active
        return Button {
            onPick(file)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: file.isScene ? "sparkles" : file.isImage ? "photo" : "film")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isActive ? Color.white : Color.yapperOrange)
                    .frame(width: 16)

                Text(file.name)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(isActive ? Color.white : Color.primary)
                    .lineLimit(1)
                    .truncationMode(.middle)

                Spacer(minLength: 8)

                // The same secondary line the file picker in an editor shows:
                // enough to tell two similarly named files apart.
                Text(detail(for: file))
                    .font(.system(size: 10.5))
                    .monospacedDigit()
                    .foregroundStyle(isActive ? Color.white.opacity(0.75) : .secondary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 8)
            .frame(height: Self.rowHeight)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isActive ? Color.yapperOrange : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { if $0 { onHover(index) } }
    }

    private func detail(for file: ProjectMedia) -> String {
        if file.isScene { return String(format: "Generated · %.1fs", file.duration) }
        return file.isImage
            ? "\(file.width)×\(file.height)"
            : String(format: "%.1fs", file.duration)
    }
}
