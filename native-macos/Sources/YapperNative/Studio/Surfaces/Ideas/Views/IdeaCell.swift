import SwiftUI

/// One cell of the table. Render only: changes go back up through closures.
struct IdeaCell: View {
    let column: IdeaColumn
    let row: IdeaItem
    let onStatus: (IdeaStatus) -> Void
    @ObservedObject var capture: IdeaCapture = .shared

    private var drafting: Bool { capture.working.contains(row.id) }

    var body: some View {
        switch column {
        case .title:
            IdeaTitleCell(row: row)
        case .pillar where drafting && row.pillar == nil:
            IdeaPendingPill(width: 96)
        case .formats where drafting:
            IdeaPendingPill(width: 72)
        case .pillar:
            IdeaPillarMenu(row: row)
        case .formats:
            IdeaVersionBadges(lead: row.leadFormat, versions: row.versions)
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
        case .added:
            quiet(IdeaDates.stamp(row.createdAt)).monospacedDigit()
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
            if let url = row.sourceUrl {
                if let platform = LinkPlatform(url: url) {
                    PlatformGlyph(platform: platform, size: 13).accessibilityLabel("From \(platform.name)")
                } else {
                    Image(systemName: "link").font(.system(size: 11)).foregroundStyle(.secondary).accessibilityLabel("Has a reference")
                }
            }
            if capture.working.contains(row.id) {
                IdeaDraftingIndicator(fromLink: row.sourceUrl != nil)
            } else if capture.analysisFailed.contains(row.id) {
                Text("First draft failed").font(.system(size: 11)).foregroundStyle(Color.studioDanger)
                Button("Retry") { capture.retry(row.id) }.buttonStyle(EditorGhostButtonStyle(size: .mini))
            }
            Spacer(minLength: 4)
            Image(systemName: "arrow.up.right").font(.system(size: 11)).foregroundStyle(Color.secondary.opacity(0.5))
        }
    }
}

/// Which versions an idea has: a letter per format, filled when written,
/// ringed on the one the idea started in, dashed when there is none yet.
struct IdeaVersionBadges: View {
    let lead: String
    let versions: Set<String>

    var body: some View {
        HStack(spacing: 4) {
            ForEach(IdeaFormat.versioned) { format in
                badge(format)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(IdeaFormat.versioned.filter { versions.contains($0.id) }.map(\.label).joined(separator: ", "))
    }

    private func badge(_ format: IdeaFormat) -> some View {
        let has = versions.contains(format.id)
        let shape = RoundedRectangle(cornerRadius: 5, style: .continuous)
        return Text(String(format.label.prefix(1)))
            .font(.system(size: 10.5, weight: .semibold))
            .foregroundStyle(has ? Color.black.opacity(0.78) : Color.secondary.opacity(0.6))
            .frame(width: 22, height: 18)
            .background { if has { shape.fill(format.tone.color) } }
            .overlay {
                if !has {
                    shape.strokeBorder(Color.studioLineStrong, style: StrokeStyle(lineWidth: 1, dash: [2, 2]))
                }
            }
            .padding(2)
            .overlay {
                if format.id == lead {
                    RoundedRectangle(cornerRadius: 7, style: .continuous).strokeBorder(format.tone.color, lineWidth: 1)
                }
            }
            .help(has ? (format.id == lead ? "\(format.label), where this idea started" : format.label) : "No \(format.label.lowercased()) yet")
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
        } else {
            // Keeps the column's width: a cell that draws nothing drops its
            // frame, and every column after it slid one column to the right.
            Color.clear.frame(height: 1)
        }
    }
}
