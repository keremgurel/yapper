import SwiftUI

/// One video in the voice set, its transcript a click away.
struct BrainVoiceSampleRow: View {
    let sample: BrainVoiceSample
    let onRemove: () -> Void

    @State private var open = false
    @State private var hovering = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                BrainThumbnail(url: sample.thumbnail, width: 32, height: 56)
                Button { open.toggle() } label: {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10, weight: .semibold))
                                .rotationEffect(.degrees(open ? 90 : 0))
                                .foregroundStyle(.secondary)
                            Text(sample.title.isEmpty ? "Untitled" : sample.title)
                                .font(.system(size: 13, weight: .semibold)).lineLimit(1)
                        }
                        Text(meta).font(.system(size: 12)).foregroundStyle(.secondary).padding(.leading, 14)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.studioPlain)
                Button(action: onRemove) {
                    Image(systemName: "xmark").font(.system(size: 11, weight: .semibold)).foregroundStyle(.secondary).frame(width: 24, height: 24)
                }
                .buttonStyle(.studioPlain)
                .opacity(hovering ? 1 : 0.35)
                .accessibilityLabel("Remove \(sample.title.isEmpty ? "this video" : sample.title) from your voice")
            }
            if open {
                ScrollView {
                    Text(sample.transcript)
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 190)
                .padding(.leading, 58)
            }
        }
        .padding(.vertical, 10)
        .onHover { hovering = $0 }
    }

    private var meta: String {
        [
            BrainVoiceFormat.platformLabel(sample.platform),
            BrainVoiceFormat.date(sample.publishedAt),
            BrainVoiceFormat.duration(sample.durationSec),
            sample.creditsCharged == 0 ? "free" : "\(sample.creditsCharged) credit\(sample.creditsCharged == 1 ? "" : "s")",
        ].filter { !$0.isEmpty }.joined(separator: " \u{00B7} ")
    }
}

/// One published video in the picker. Already-sampled ones can't be picked twice.
struct BrainVideoTile: View {
    let platform: String
    let video: BrainChannelVideo
    let selected: Bool
    let sampled: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(alignment: .top, spacing: 10) {
                BrainThumbnail(url: video.thumbnail, width: 45, height: 80)
                VStack(alignment: .leading, spacing: 4) {
                    Text(video.title.isEmpty ? "Untitled" : video.title)
                        .font(.system(size: 13, weight: .semibold)).lineLimit(2).multilineTextAlignment(.leading)
                    Text([BrainVoiceFormat.date(video.publishedAt), BrainVoiceFormat.duration(video.durationSec)]
                        .filter { !$0.isEmpty }.joined(separator: " \u{00B7} "))
                        .font(.system(size: 12)).foregroundStyle(.secondary)
                    Text(status).font(.system(size: 12)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                ZStack {
                    Circle().strokeBorder(selected ? Color.yapperOrange : Color.studioLineStrong, lineWidth: 1)
                    if selected {
                        Circle().fill(Color.yapperOrange)
                        Image(systemName: "checkmark").font(.system(size: 9, weight: .semibold)).foregroundStyle(.white)
                    }
                }
                .frame(width: 18, height: 18)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(selected ? Color.studioSelectedFill : .clear)
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(selected ? Color.yapperOrange : Color.studioLine))
            )
        }
        .buttonStyle(.studioPlain)
        .disabled(sampled || BrainVoiceCredits.tooLong(video.durationSec))
        .opacity(sampled ? 0.55 : 1)
    }

    private var status: String {
        if sampled { return "Already in your voice" }
        if BrainVoiceCredits.tooLong(video.durationSec) { return "Longer than 24 minutes" }
        return BrainVoiceCredits.costLabel(platform: platform, duration: video.durationSec)
    }
}

/// A remote thumbnail in a quiet frame.
struct BrainThumbnail: View {
    let url: String?
    let width: CGFloat
    let height: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: 5, style: .continuous)
            .fill(Color.studioFaintFill)
            .overlay {
                if let url, let parsed = URL(string: url) {
                    AsyncImage(url: parsed) { image in
                        image.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: { Color.clear }
                }
            }
            .frame(width: width, height: height)
            .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
    }
}
