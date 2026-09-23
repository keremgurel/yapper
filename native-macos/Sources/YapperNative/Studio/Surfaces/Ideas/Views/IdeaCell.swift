import SwiftUI

/// One cell of the table. Render only: changes go back up through closures.
struct IdeaCell: View {
    let column: IdeaColumn
    let row: IdeaItem
    let onStatus: (IdeaStatus) -> Void

    var body: some View {
        switch column {
        case .title:
            IdeaTitleCell(row: row)
        case .pillar:
            if let pillar = row.pillar { NativeChip(text: pillar, tone: IdeaPillarTone.tone(for: pillar), dot: true) } else { empty }
        case .formats:
            if row.formats.isEmpty { empty } else { IdeaFormatChips(formats: row.formats) }
        case .type:
            if let kind = row.ideaType.flatMap(IdeaKind.init(rawValue:)) { quiet(kind.label) } else { empty }
        case .transcript:
            if let state = IdeaReferenceState.label(row.transcriptStatus) {
                Text(state.text).font(.system(size: 13)).lineLimit(1)
                    .foregroundStyle(state.caution ? NativeChip.Tone.yellow.color : Color.secondary)
            } else { empty }
        case .status:
            IdeaStatusMenu(status: row.pipelineStatus, onChange: onStatus)
        case .script:
            if row.hasScript {
                Image(systemName: "doc.text").font(.system(size: 13)).foregroundStyle(.secondary).accessibilityLabel("Has a script")
            } else { empty }
        case .updated:
            quiet(IdeaDates.stamp(row.updatedAt)).monospacedDigit()
        case .actions:
            IdeaRowActions(row: row)
        }
    }

    private var empty: some View {
        Image(systemName: "minus").font(.system(size: 11)).foregroundStyle(Color.secondary.opacity(0.4))
    }

    private func quiet(_ text: String) -> some View {
        Text(text).font(.system(size: 13)).foregroundStyle(.secondary).lineLimit(1)
    }
}

/// The title, whether it has a reference, and the first pass while it runs.
struct IdeaTitleCell: View {
    let row: IdeaItem
    @ObservedObject var capture: IdeaCapture = .shared

    var body: some View {
        HStack(spacing: 8) {
            Text(row.displayTitle).font(.system(size: 13, weight: .medium)).lineLimit(1)
            if row.sourceUrl != nil {
                Image(systemName: "link").font(.system(size: 11)).foregroundStyle(.secondary).accessibilityLabel("Has a reference")
            }
            if capture.working.contains(row.id) {
                ProgressView().controlSize(.mini)
                Text("Drafting…").font(.system(size: 11)).foregroundStyle(.secondary)
            } else if capture.analysisFailed.contains(row.id) {
                Text("First draft failed").font(.system(size: 11)).foregroundStyle(Color.studioDanger)
                Button("Retry") { capture.retry(row.id) }.buttonStyle(EditorGhostButtonStyle(size: .mini))
            }
            Spacer(minLength: 4)
            Image(systemName: "arrow.up.right").font(.system(size: 11)).foregroundStyle(Color.secondary.opacity(0.5))
        }
    }
}

/// Format chips in library order.
struct IdeaFormatChips: View {
    let formats: [String]
    var body: some View {
        HStack(spacing: 4) {
            ForEach(IdeaFormat.all.filter { formats.contains($0.id) }) { format in
                NativeChip(text: format.label, tone: format.tone)
            }
        }
        .lineLimit(1)
    }
}

/// Only a row with a recording can go to the editor or be posted.
struct IdeaRowActions: View {
    let row: IdeaItem

    var body: some View {
        if row.submissionId != nil {
            HStack(spacing: 2) {
                Button { StudioWebCommands.shared.openEditor(StudioEditorRequest(itemID: UUID(uuidString: row.id))) } label: {
                    Image(systemName: "film").font(.system(size: 13))
                }
                .buttonStyle(EditorGhostButtonStyle(size: .mini))
                .help("Open in the editor")
                Button { StudioWebCommands.shared.openPoster(itemID: row.id) } label: {
                    Image(systemName: "paperplane").font(.system(size: 13))
                }
                .buttonStyle(EditorGhostButtonStyle(size: .mini))
                .help("Post to a platform")
            }
        }
    }
}
