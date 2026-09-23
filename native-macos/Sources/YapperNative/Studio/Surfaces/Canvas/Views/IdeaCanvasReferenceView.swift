import SwiftUI

/// Where the piece came from: what the creator said on camera, what the
/// reference says, and the creator's original note.
struct IdeaCanvasReferenceView: View {
    let item: IdeaCanvasItem
    @State private var noteOpen = true

    var body: some View {
        VStack(alignment: .leading, spacing: 32) {
            if let recorded = trimmed(item.recordedTranscript) {
                VStack(alignment: .leading, spacing: 0) {
                    IdeaCanvasSectionTitle("What you said", meta: "from your recording")
                    reading(recorded)
                }
            }
            if hasInspiration {
                VStack(alignment: .leading, spacing: 0) {
                    IdeaCanvasSectionTitle("Inspiration", meta: inspirationMeta) { sourceLink }
                    inspirationBody
                }
            }
            if let note = trimmed(item.originalNote) {
                VStack(alignment: .leading, spacing: 8) {
                    Button { noteOpen.toggle() } label: {
                        HStack(spacing: 6) {
                            Image(systemName: noteOpen ? "chevron.down" : "chevron.right").font(.system(size: 11, weight: .semibold))
                            Text("Your original note").font(.nativeSectionTitle)
                        }
                    }
                    .buttonStyle(.studioPlain)
                    if noteOpen {
                        Text(note)
                            .font(.system(size: 15)).lineSpacing(4)
                            .foregroundStyle(Color.primary.opacity(0.75))
                            .textSelection(.enabled)
                            .frame(maxWidth: 640, alignment: .leading)
                            .nativeWell(padding: 14, radius: 12)
                    }
                }
            }
        }
    }

    private var transcript: String? { trimmed(item.sourceTranscript) }
    private var summary: String? { trimmed(item.sourceSummary) }
    private var hasInspiration: Bool {
        transcript != nil || summary != nil || item.sourceTitle != nil || item.sourceUrl != nil
    }

    private var inspirationMeta: String? {
        let kind: String? = switch item.ideaType {
        case "semi-original": "semi-original"
        case "inspiration": "inspired by"
        default: nil
        }
        let words: String? = item.transcriptStatus == "pending" ? "transcribing"
            : transcript != nil ? "transcript" : summary != nil ? "page summary" : nil
        let parts = [kind, words].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    @ViewBuilder private var sourceLink: some View {
        if let raw = item.sourceUrl, let url = URL(string: raw) {
            Link(destination: url) {
                HStack(spacing: 4) {
                    Text(truncate(item.sourceTitle ?? "Open reference", 48))
                    Image(systemName: "arrow.up.right")
                }
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
            }
            .clickableCursor()
        }
    }

    @ViewBuilder private var inspirationBody: some View {
        if let transcript {
            reading(transcript)
        } else if let summary {
            VStack(alignment: .leading, spacing: 8) {
                reading(summary)
                Text("This is a summary of the page, not the reference's spoken words.")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
            }
        } else if item.transcriptStatus == "pending" {
            Text("Fetching the transcript. It shows up here when it lands.")
                .font(.system(size: 13)).foregroundStyle(.secondary)
        } else {
            Text("No transcript for this reference yet, so Chirpy only knows what you wrote about it.")
                .font(.system(size: 13)).foregroundStyle(.secondary)
                .frame(maxWidth: 560, alignment: .leading)
        }
    }

    private func reading(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 15)).lineSpacing(4)
            .foregroundStyle(Color.primary.opacity(0.8))
            .textSelection(.enabled)
            .frame(maxWidth: 640, alignment: .leading)
    }

    private func trimmed(_ text: String?) -> String? {
        let value = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? nil : value
    }

    private func truncate(_ text: String, _ max: Int) -> String {
        text.count > max ? String(text.prefix(max - 1)) + "…" : text
    }
}
