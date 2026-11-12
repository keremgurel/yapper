import SwiftUI

/// The long-form's chapters beside the script: each title with its length,
/// and a warning when there are too few for YouTube to show them.
struct IdeaCanvasChaptersPanel: View {
    let script: String

    var body: some View {
        let chapters = IdeaCanvasChapters.chapters(in: script)
        VStack(alignment: .leading, spacing: 0) {
            IdeaCanvasSectionTitle("Chapters", meta: chapters.isEmpty ? nil : "\(chapters.count)")
            if chapters.isEmpty {
                Text("Start a line with ## and a short title to mark a chapter.")
                    .font(.studioLabel).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: 0) {
                    ForEach(chapters) { chapter in
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text("\(chapter.index + 1)")
                                .font(.studioCaptionStrong.monospacedDigit())
                                .foregroundStyle(.tertiary)
                                .frame(width: 14, alignment: .trailing)
                            Text(chapter.title)
                                .font(.studioBody)
                                .lineLimit(2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text(IdeaCanvasText.speakingTime(words: chapter.words))
                                .font(.studioCaption.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 8)
                        if chapter.index < chapters.count - 1 {
                            Rectangle().fill(Color.studioLine).frame(height: 1)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.studioFaintFill))
                if chapters.count < IdeaCanvasChapters.youTubeMinimum {
                    Text("YouTube needs at least \(IdeaCanvasChapters.youTubeMinimum) chapters to show them.")
                        .font(.studioLabel).foregroundStyle(NativeChip.Tone.yellow.color)
                        .padding(.top, 8)
                }
            }
        }
    }
}
