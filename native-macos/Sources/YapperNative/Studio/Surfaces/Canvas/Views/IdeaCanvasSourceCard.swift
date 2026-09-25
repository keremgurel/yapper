import SwiftUI

/// The video or page this idea came from, near the top of the side column:
/// its platform, its title, a way to open it, and whether the idea is still
/// only borrowed. The full transcript stays in "Where this came from".
struct IdeaCanvasSourceCard: View {
    let item: IdeaCanvasItem

    private var platform: LinkPlatform? { item.sourceUrl.flatMap(LinkPlatform.init(url:)) }
    private var url: URL? { item.sourceUrl.flatMap(URL.init(string:)) }
    private var borrowedOnly: Bool { item.ideaType == "inspiration" }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            IdeaCanvasSectionTitle("Source", meta: borrowedOnly ? "inspiration" : item.ideaType == "semi-original" ? "semi-original" : nil)
            VStack(alignment: .leading, spacing: 12) {
                header
                if let title = item.sourceTitle?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty {
                    Text(title)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.primary.opacity(0.85))
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if borrowedOnly {
                    Text("This is someone else's video with nothing of yours in it yet. Add your own note below and it becomes semi-original.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.studioFaintFill))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            if let platform {
                PlatformGlyph(platform: platform, size: 28)
            } else {
                Image(systemName: "link")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 28, height: 28)
                    .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.studioRaisedChip))
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(platform?.name ?? url?.host ?? "Reference")
                    .font(.system(size: 13, weight: .semibold))
                if let path = shortLink {
                    Text(path).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1).truncationMode(.middle)
                }
            }
            Spacer(minLength: 8)
            if let url {
                Link(destination: url) {
                    Label("Open", systemImage: "arrow.up.right")
                        .font(.system(size: 12, weight: .medium))
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                .help("Open the original")
            }
        }
    }

    /// The link without its scheme or `www.`, e.g. `instagram.com/p/DaDjrBqxfdH`.
    private var shortLink: String? {
        guard let url, let host = url.host else { return nil }
        let bare = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
        let path = url.path.hasSuffix("/") ? String(url.path.dropLast()) : url.path
        return bare + path
    }
}
