import SwiftUI

/// What is about to go out, per video and platform, exactly as written in
/// the Poster. Read only: editing happens where the limits are shown.
struct PosterPreparedCaptions: View {
    let targets: [PosterPublishTarget]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(targets) { target in
                let written = PublishPlatform.allCases.filter { target.captions[$0]?.hasText == true }
                VStack(alignment: .leading, spacing: 10) {
                    if targets.count > 1 { Text(target.title).font(.system(size: 13, weight: .medium)).lineLimit(1) }
                    if written.isEmpty {
                        Text("No caption written. This one posts with its cover text as the title and nothing else.")
                            .font(.system(size: 13)).foregroundStyle(.secondary)
                    }
                    ForEach(written) { platform in
                        if let caption = target.captions[platform] { row(platform, caption) }
                    }
                }
            }
        }
    }

    private func row(_ platform: PublishPlatform, _ caption: PosterCaption) -> some View {
        let spec = PosterCaptionSpec.of(platform)
        return VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: platform.symbol).font(.system(size: 11)).foregroundStyle(.secondary)
                Text(spec.label).font(.system(size: 13, weight: .semibold))
                Spacer()
                Button("Copy", systemImage: "doc.on.doc") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(caption.rendered, forType: .string)
                }
                .buttonStyle(EditorGhostButtonStyle(size: .mini))
            }
            if spec.hasTitle && !caption.title.isEmpty {
                Text(caption.title).font(.system(size: 13, weight: .medium))
            }
            Text(caption.rendered).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(4)
        }
        .nativeWell(padding: 10, radius: 8)
    }
}

/// What happened, per video and destination. Failures stay beside successes.
struct PosterOutcomeList: View {
    let outcomes: [PosterOutcome]

    var body: some View {
        if !outcomes.isEmpty {
            VStack(spacing: 0) {
                ForEach(Array(outcomes.enumerated()), id: \.element.id) { index, outcome in
                    if index > 0 { Rectangle().fill(Color.studioLine).frame(height: 1) }
                    row(outcome)
                }
            }
            .background(NativeCardBackground(radius: 10))
        }
    }

    private func row(_ outcome: PosterOutcome) -> some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(outcome.videoTitle).font(.system(size: 13, weight: .medium)).lineLimit(1)
                Text(outcome.platform.label).font(.system(size: 12)).foregroundStyle(.secondary)
                if let error = outcome.error {
                    Text(PosterErrorCopy.publish(error)).font(.system(size: 12)).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if outcome.status == .draft {
                    Text("Open TikTok, go to your inbox and tap \"Your content from Yapper is ready\" to finish posting.")
                        .font(.system(size: 12)).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer()
            if let url = outcome.url {
                Link(destination: url) { Label("Posted", systemImage: "arrow.up.right") }
                    .font(.system(size: 12, weight: .semibold))
                    .clickableCursor()
            } else {
                Text(outcome.label).font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(outcome.status == .failed ? Color.studioDanger
                                     : outcome.status == .pending ? Color.secondary : NativeChip.Tone.green.color)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
    }
}
