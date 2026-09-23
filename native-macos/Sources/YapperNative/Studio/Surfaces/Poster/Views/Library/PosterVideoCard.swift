import SwiftUI

/// One video, portrait like the video itself. The whole card opens it.
/// A channel post Yapper has no file for is shown but cannot be opened.
struct PosterVideoCard: View {
    let video: PosterVideo
    let importing: Bool
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 0) {
                PosterVideoStill(video: video)
                    .aspectRatio(9 / 16, contentMode: .fit)
                    .overlay {
                        if importing {
                            ZStack {
                                Color.black.opacity(0.45)
                                ProgressView().controlSize(.small)
                            }
                        }
                    }
                VStack(alignment: .leading, spacing: 6) {
                    Text(video.title)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    meta
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
            }
            .background(Color.panelBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
            .opacity(video.canOpen ? 1 : 0.6)
        }
        .buttonStyle(.studioPlain)
        .disabled(!video.canOpen || importing)
        .help(video.canOpen ? "" : "Only videos posted through Yapper can be reposted from here")
    }

    @ViewBuilder
    private var meta: some View {
        switch video.origin {
        case let .yapper(_, _, status, scheduledFor, _):
            HStack(spacing: 8) {
                Text(PosterFormat.scheduled(scheduledFor)).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
                Spacer(minLength: 0)
                NativeChip(text: status.capitalized, tone: PosterFormat.statusTone(status))
            }
        case let .platform(_, _, _, _, views, publishedAt, _, _, _):
            HStack(spacing: 8) {
                Text(PosterFormat.day(publishedAt)).font(.system(size: 11)).foregroundStyle(.secondary)
                Spacer(minLength: 0)
                Label(PosterFormat.views(views), systemImage: "eye")
                    .font(.system(size: 11).monospacedDigit())
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
