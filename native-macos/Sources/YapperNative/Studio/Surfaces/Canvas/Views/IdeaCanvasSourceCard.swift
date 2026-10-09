import SwiftUI

/// The video or page this idea came from, near the top of the side column:
/// its platform, its title, a way to open it, and whether the idea is still
/// only borrowed, and what it actually says: the transcript, a few lines by
/// default and the whole thing a click away.
struct IdeaCanvasSourceCard: View {
    let item: IdeaCanvasItem
    @State private var expanded = false

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
                transcriptBlock
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

    private var transcript: String? {
        let value = item.sourceTranscript?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? nil : value
    }

    @ViewBuilder private var transcriptBlock: some View {
        if let transcript {
            VStack(alignment: .leading, spacing: 8) {
                Rectangle().fill(Color.studioLine).frame(height: 1)
                Text("Transcript · \(transcript.split(whereSeparator: \.isWhitespace).count) words")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                Text(transcript)
                    .font(.system(size: 13)).lineSpacing(3)
                    .foregroundStyle(Color.primary.opacity(0.85))
                    .lineLimit(expanded ? nil : 6)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                Button(expanded ? "Show less" : "Show full transcript") {
                    withAnimation(.snappy(duration: 0.18)) { expanded.toggle() }
                }
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
                .buttonStyle(.studioPlain)
                .clickableCursor()
            }
        } else if item.transcriptStatus == "pending" {
            Text("Fetching the transcript. It shows up here when it lands.")
                .font(.system(size: 12)).foregroundStyle(.secondary)
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
                Text(sourceName)
                    .font(.system(size: 13, weight: .semibold))
                if let path = internalSource ? item.title : shortLink {
                    Text(path).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1).truncationMode(.middle)
                }
            }
            Spacer(minLength: 8)
            IdeaCanvasSourceLink(item: item)
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
        }
    }

    private var internalSource: Bool { url?.scheme == "yapper" }
    private var sourceName: String {
        if internalSource { return url?.host == "project" ? "Editor project" : "Poster upload" }
        return platform?.name ?? url?.host ?? "Reference"
    }

    /// The link without its scheme or `www.`, e.g. `instagram.com/p/DaDjrBqxfdH`.
    private var shortLink: String? {
        guard let url, let host = url.host else { return nil }
        let bare = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
        let path = url.path.hasSuffix("/") ? String(url.path.dropLast()) : url.path
        return bare + path
    }
}

/// The canvas intercepts internal links and saves pending edits before opening them.
struct IdeaCanvasSourceLink: View {
    let item: IdeaCanvasItem

    @ViewBuilder var body: some View {
        if let raw = item.sourceUrl, let url = URL(string: raw) {
            if url.scheme == "yapper", url.host == "project" {
                Link(destination: url) {
                    Label("Open project", systemImage: "arrow.up.right")
                }
                .help("Open the original editor project on this Mac")
            } else if url.scheme == "yapper", url.host == "poster-upload" {
                Link(destination: url) {
                    Label("Open in Poster", systemImage: "arrow.up.right")
                }
            } else if ["https", "http"].contains(url.scheme?.lowercased() ?? "") {
                Link(destination: url) { Label("Open", systemImage: "arrow.up.right") }
                    .help("Open the original")
            }
        }
    }
}
