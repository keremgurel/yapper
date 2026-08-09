import SwiftUI

/// The account badge at the top right: the web's own, with its shimmer.
///
/// A button and a popover rather than a `Menu`, and that is the whole reason it
/// looks like anything at all. A macOS `Menu` flattens whatever label you hand
/// it down to the text inside: the avatar's circle, the pill, the border and
/// the shadow were all thrown away and what reached the screen was the two
/// letters from inside the avatar next to a chevron AppKit drew itself. A
/// button keeps every pixel of its label, so the badge here is the badge that
/// renders.
struct WorkspaceProfileBadge: View {
    let name: String
    let onNavigate: (StudioDestination) -> Void
    /// Hidden when the bar is tight, because a truncated workspace name is
    /// worse than none: "Celpip Speak…" reads as an error, and the avatar
    /// already identifies it.
    var showsName = true

    @State private var isHovering = false
    @State private var isOpen = false

    /// One letter, like the web's. Two initials made a monogram of a name the
    /// badge is already showing in full beside it.
    private var initial: String {
        String(name.first ?? "Y").uppercased()
    }

    var body: some View {
        Button {
            isOpen.toggle()
        } label: {
            HStack(spacing: 8) {
                AccountShimmerAvatar(initials: initial, diameter: 24, isSweeping: isHovering)
                if showsName {
                    Text(name)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .fixedSize()
                }
                Image(systemName: "chevron.down")
                    .font(.system(size: 8.5, weight: .bold))
                    .foregroundStyle(.secondary)
            }
            .padding(.leading, 4)
            .padding(.trailing, showsName ? 10 : 7)
            .frame(height: 34)
            .background {
                Capsule(style: .continuous)
                    .fill(isHovering ? Color.studioFaintFill : Color.raisedBackground)
                    .overlay {
                        Capsule(style: .continuous)
                            .strokeBorder(
                                isHovering ? Color.studioLineStrong : Color.studioLine,
                                lineWidth: 1
                            )
                    }
                    .shadow(
                        color: .black.opacity(isHovering ? 0.16 : 0.08),
                        radius: isHovering ? 5 : 2,
                        y: 1
                    )
            }
            .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.14), value: isHovering)
        .help(name)
        .accessibilityLabel("Workspace: \(name)")
        .popover(isPresented: $isOpen, arrowEdge: .bottom) {
            WorkspaceProfileMenu(name: name) { destination in
                isOpen = false
                onNavigate(destination)
            }
        }
    }
}

/// What the badge opens: where else in the workspace you can go.
private struct WorkspaceProfileMenu: View {
    let name: String
    let onNavigate: (StudioDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(name)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 10)
                .padding(.top, 8)
                .padding(.bottom, 4)

            row("Idea Bank", "lightbulb", .ideas)
            row("Content Library", "square.stack.3d.up", .library)
            Divider().padding(.vertical, 4)
            row("Dictionary", "character.book.closed", .dictionary)
            row("Connections", "link", .connections)
        }
        .padding(.bottom, 6)
        .frame(width: 210)
    }

    private func row(
        _ title: String,
        _ icon: String,
        _ destination: StudioDestination
    ) -> some View {
        WorkspaceMenuRow(title: title, icon: icon) { onNavigate(destination) }
    }
}

/// One line of the menu, highlighting under the pointer the way a menu does.
private struct WorkspaceMenuRow: View {
    let title: String
    let icon: String
    let action: () -> Void

    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isHovering ? Color.white : Color.secondary)
                    .frame(width: 16)
                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(isHovering ? Color.white : Color.primary)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .frame(height: 28)
            .background {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(isHovering ? Color.yapperOrange : Color.clear)
                    .padding(.horizontal, 4)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .onHover { isHovering = $0 }
    }
}
