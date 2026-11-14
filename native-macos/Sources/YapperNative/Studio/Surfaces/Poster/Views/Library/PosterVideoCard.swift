import SwiftUI

/// One video, portrait like the video itself. The whole card opens it.
/// A channel post Yapper has no file for is shown but cannot be opened.
struct PosterVideoCard: View {
    @ObservedObject private var sync = PosterProjectSync.shared
    let video: PosterVideo
    let importing: Bool
    var onTrashProject: ((ProjectListing) -> Void)? = nil
    let onOpen: () -> Void
    @State private var confirmRemoval = false
    @State private var removing = false
    @State private var removalError: String?

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 12) {
                PosterVideoStill(video: video, iconSize: 12)
                    .frame(width: 32, height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                    .overlay { if importing { ProgressView().controlSize(.mini) } }
                VStack(alignment: .leading, spacing: 4) {
                    Text(video.title).font(.studioBodyStrong)
                        .lineLimit(2).multilineTextAlignment(.leading)
                    if case .project = video.origin { meta }
                }
                Spacer(minLength: 8)
                Text(video.needsOriginal ? "Attach original" : "Use video")
                    .font(.studioLabel).foregroundStyle(.secondary)
            }
            .padding(.vertical, 8)
            .padding(.trailing, canRemove ? 40 : 0)
            .contentShape(Rectangle())
            .opacity(video.canOpen ? 1 : 0.6)
        }
        .buttonStyle(.studioPlain)
        .disabled(!video.canOpen || importing)
        .accessibilityHint(video.needsOriginal ? "Opens the step to attach this post's original video" : "")
        .overlay(alignment: .trailing) {
            if canRemove {
                Button { confirmRemoval = true } label: {
                    Image(systemName: "xmark").font(.studioBodyStrong)
                        .foregroundStyle(Color.studioDanger).frame(width: 32, height: 32)
                        .background(Circle().fill(Color.panelBackground))
                }.buttonStyle(.studioPlain).disabled(removing).help("Remove upload")
                    .accessibilityLabel("Remove \(video.title)")
            }
        }
        .alert("Remove this upload?", isPresented: $confirmRemoval) {
            Button("Cancel", role: .cancel) { }
            Button("Remove upload", role: .destructive) {
                guard let id = video.contentItemID else { return }
                removing = true
                Task {
                    defer { removing = false }
                    do {
                        try await StudioJSONClient.delete("api/publish/uploads/\(id)")
                        await PosterLibraryStore.shared.refresh()
                    } catch { removalError = "Couldn’t remove this upload. It may still be needed for publishing or a scheduled post. Try again after it finishes." }
                }
            }
        } message: { Text("Your original file and published posts stay untouched.") }
        .alert("Upload could not be removed", isPresented: Binding(get: { removalError != nil }, set: { if !$0 { removalError = nil } })) {
            Button("OK") { removalError = nil }
        } message: { Text(removalError ?? "") }
        .contextMenu {
            if case let .project(listing) = video.origin, let onTrashProject {
                Button("Show in Finder") { ProjectPanels.revealInFinder(listing.package) }
                Button("Move project to Trash", role: .destructive) { onTrashProject(listing) }
            }
        }
        .help(video.canOpen ? "" : "Only videos posted through Yapper can be reposted from here")
    }

    private var canRemove: Bool {
        guard case let .yapper(_, id, _, _, _) = video.origin else { return false }
        return PosterLibraryStore.shared.items?.first(where: { $0.id == id })?.sourceUrl == "yapper://poster-upload"
    }

    @ViewBuilder
    private var meta: some View {
        switch video.origin {
        case let .project(listing):
            VStack(alignment: .leading, spacing: 4) {
                Text("Latest edit · \(Int(listing.summary.duration))s")
                if let status = sync.status[listing.summary.id] { Text(status) }
                else if sync.errors[listing.summary.id] != nil { Text("Preview needs attention").foregroundStyle(NativeChip.Tone.yellow.color) }
            }.font(.studioLabel).foregroundStyle(.secondary)
        case .file:
            Text("Uploading…").font(.studioLabel).foregroundStyle(.secondary)
        case let .yapper(_, _, status, scheduledFor, _):
            HStack(spacing: 8) {
                Text(PosterFormat.scheduled(scheduledFor)).font(.studioCaption).foregroundStyle(.secondary).lineLimit(1)
                Spacer(minLength: 0)
                NativeChip(text: status.capitalized, tone: PosterFormat.statusTone(status))
            }
        case let .platform(_, _, _, _, views, publishedAt, _, _, _):
            HStack(spacing: 8) {
                Text(PosterFormat.day(publishedAt)).font(.studioCaption).foregroundStyle(.secondary)
                Spacer(minLength: 0)
                Label(PosterFormat.views(views), systemImage: "eye")
                    .font(.studioCaption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
    }
}

enum PosterFormat {
    static func statusTone(_ status: String) -> NativeChip.Tone {
        switch status {
        case "drafting": .cyan
        case "ready": .yellow
        case "posted": .green
        default: .neutral
        }
    }

    static func views(_ count: Int) -> String {
        if count >= 1_000_000 { return String(format: "%.1fM", Double(count) / 1_000_000) }
        if count >= 1_000 { return String(format: "%.1fK", Double(count) / 1_000) }
        return String(count)
    }

    static func date(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return precise.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    static func day(_ iso: String) -> String {
        date(iso)?.formatted(.dateTime.month(.abbreviated).day()) ?? ""
    }

    static func scheduled(_ iso: String?) -> String {
        guard let date = date(iso) else { return "Not scheduled" }
        return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
    }
}
