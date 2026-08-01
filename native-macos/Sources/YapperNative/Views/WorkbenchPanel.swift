import SwiftUI

private enum WorkbenchTab: String, CaseIterable, Identifiable {
    case media = "Media"
    case quick = "Quick Edit"
    case transcript = "Transcript"
    case audio = "Audio"
    case text = "Text"
    case captions = "Captions"
    case filters = "Filters"

    var id: String { rawValue }
    var icon: String {
        switch self {
        case .media: "film.stack"
        case .quick: "wand.and.stars"
        case .transcript: "doc.text"
        case .audio: "waveform"
        case .text: "textformat"
        case .captions: "captions.bubble"
        case .filters: "slider.horizontal.3"
        }
    }
}

struct WorkbenchPanel: View {
    @ObservedObject var session: EditorSession
    @State private var selectedTab: WorkbenchTab = .media

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 2) {
                    ForEach(WorkbenchTab.allCases) { tab in
                        Button {
                            selectedTab = tab
                        } label: {
                            VStack(spacing: 5) {
                                Image(systemName: tab.icon)
                                    .font(.system(size: 14, weight: .semibold))
                                Text(tab.rawValue)
                                    .font(.system(size: 11, weight: .semibold))
                            }
                            .foregroundStyle(
                                selectedTab == tab ? Color.yapperOrange : Color.secondary
                            )
                            .frame(width: tab == .quick ? 72 : 58, height: 52)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 8)
            }
            .background(Color.panelBackground)

            Rectangle()
                .fill(Color.yapperOrange)
                .frame(height: 2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .opacity(0.75)

            Group {
                switch selectedTab {
                case .media:
                    MediaWorkbench(session: session)
                case .quick:
                    QuickEditWorkbench(session: session)
                case .transcript:
                    TranscriptWorkbench(session: session)
                default:
                    FeatureWorkbench(tab: selectedTab)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.panelBackground)
    }
}

private struct MediaWorkbench: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Media")
                        .font(.system(size: 15, weight: .bold))
                    Text("Video stays local on this Mac")
                        .font(.studioBody)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Import") { ImportPanels.openMedia(for: session) }
                    .buttonStyle(EditorSecondaryButtonStyle())
            }

            if session.project.media.isEmpty {
                Button { ImportPanels.openMedia(for: session) } label: {
                    VStack(spacing: 10) {
                        Image(systemName: "plus.rectangle.on.rectangle")
                            .font(.system(size: 28, weight: .light))
                        Text("Import one or several videos")
                            .font(.system(size: 13, weight: .semibold))
                        Text("They are appended directly to the native timeline.")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 180)
                    .background(Color.raisedBackground)
                    .overlay(
                        RoundedRectangle(cornerRadius: 9)
                            .stroke(Color.studioLine, style: StrokeStyle(dash: [5]))
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                }
                .buttonStyle(.plain)
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(session.project.media) { media in
                            HStack(spacing: 10) {
                                Group {
                                    if let image = session.thumbnailsByMedia[media.id]?.first {
                                        Image(decorative: image, scale: 1)
                                            .resizable()
                                            .scaledToFill()
                                    } else {
                                        Rectangle().fill(Color.black)
                                            .overlay(ProgressView().controlSize(.small))
                                    }
                                }
                                .frame(width: 112, height: 64)
                                .clipped()
                                .clipShape(RoundedRectangle(cornerRadius: 6))

                                VStack(alignment: .leading, spacing: 5) {
                                    Text(media.name)
                                        .font(.studioBodyStrong)
                                        .lineLimit(2)
                                    Text("\(media.width)×\(media.height) · \(formatTime(media.duration))")
                                        .font(.studioCaption)
                                        .foregroundStyle(.secondary)
                                    if let progress = session.waveformProgressByMedia[media.id], progress < 1 {
                                        ProgressView(value: progress)
                                            .tint(.cyan)
                                    } else {
                                        Label("Waveform ready", systemImage: "waveform")
                                            .font(.studioCaption)
                                            .foregroundStyle(.cyan)
                                    }
                                }
                                Spacer(minLength: 0)
                                HStack(spacing: 6) {
                                    if !media.isImage {
                                        Button("Base") {
                                            Task { await session.appendMediaToTimeline(media.id) }
                                        }
                                        .buttonStyle(EditorSecondaryButtonStyle())
                                    }
                                    Button("Overlay") {
                                        Task { await session.addOverlay(media.id) }
                                    }
                                    .buttonStyle(EditorSecondaryButtonStyle())
                                    .disabled(session.project.clips.isEmpty || !media.isImage)
                                }
                            }
                            .padding(9)
                            .background(Color.raisedBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 9))
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
    }
}

private struct QuickEditWorkbench: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Quick Edit")
                .font(.system(size: 15, weight: .bold))
            Text("AI edits will operate on this native timeline without rebuilding the player between clips.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 10) {
                QuickAction(
                    title: (session.project.transcript?.isEmpty == false) ? "Transcribe Again" : "Transcribe",
                    detail: "Accurate timed words",
                    icon: "doc.text",
                    busy: session.isAIEditing
                ) {
                    Task { await session.transcribeProject() }
                }
                QuickAction(
                    title: session.isAIEditing ? "Editing…" : "1-Click Edit",
                    detail: "Retakes + dead pauses",
                    icon: "wand.and.stars",
                    busy: session.isAIEditing
                ) {
                    Task { await session.runOneClickEdit() }
                }
                QuickAction(
                    title: "Add Captions",
                    detail: "Not migrated yet",
                    icon: "captions.bubble",
                    disabled: true
                ) {}
                QuickAction(
                    title: "Text Hook",
                    detail: "Not migrated yet",
                    icon: "textformat",
                    disabled: true
                ) {}
            }
            .disabled(session.project.clips.isEmpty)

            if session.isAIEditing {
                ProgressView(value: session.aiProgress)
                    .tint(Color.yapperOrange)
                Text(session.statusMessage)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }

            Divider()
            Text("Native timeline tools")
                .font(.studioCaptionStrong)
                .foregroundStyle(.secondary)
            HStack {
                Button("Split at playhead") {
                    Task { await session.splitAtPlayhead() }
                }
                .buttonStyle(EditorSecondaryButtonStyle())
                Button("Delete clip") {
                    Task { await session.deleteSelected() }
                }
                .buttonStyle(EditorSecondaryButtonStyle())
                .disabled(session.selectedClipID == nil)
                Button("Reset to source") {
                    Task { await session.resetTimelineToSource() }
                }
                .buttonStyle(EditorSecondaryButtonStyle())
            }
            Spacer()
        }
        .padding(16)
    }
}

private struct QuickAction: View {
    let title: String
    let detail: String
    let icon: String
    var busy = false
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 9) {
                if busy {
                    ProgressView().controlSize(.small).tint(Color.yapperOrange)
                } else {
                    Image(systemName: icon)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color.yapperOrange)
                }
                Text(title)
                    .font(.studioBodyStrong)
                Text(detail)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 78, alignment: .leading)
            .padding(12)
            .background(Color.raisedBackground)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.studioLine, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .disabled(disabled || busy)
        .opacity(disabled ? 0.48 : 1)
    }
}

private struct TranscriptWorkbench: View {
    @ObservedObject var session: EditorSession

    private var words: [TranscriptWord] { session.project.transcript ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Transcript").font(.studioSectionTitle)
                    Text(words.isEmpty ? "Transcribe to edit by words" : "\(words.count) timed words")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button(words.isEmpty ? "Transcribe" : "Transcribe Again") {
                    Task { await session.transcribeProject() }
                }
                .buttonStyle(EditorSecondaryButtonStyle())
                .disabled(session.isAIEditing || session.project.clips.isEmpty)
            }

            if session.isAIEditing {
                ProgressView(value: session.aiProgress).tint(Color.yapperOrange)
                Text(session.statusMessage).font(.studioCaption).foregroundStyle(.secondary)
            }

            if words.isEmpty {
                ContentUnavailableView(
                    "No transcript yet",
                    systemImage: "doc.text.magnifyingglass",
                    description: Text("The native transcriber sends clean PCM chunks to the same accurate service as the web editor.")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    TranscriptFlowLayout(spacing: 6) {
                        ForEach(words) { word in
                            let kept = session.project.isWordKept(word)
                            Text(word.text)
                                .font(.system(size: 14, weight: kept ? .medium : .regular))
                                .foregroundStyle(kept ? Color.primary : Color.secondary.opacity(0.58))
                                .strikethrough(!kept, color: Color.secondary)
                                .padding(.vertical, 3)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(16)
    }
}

private struct TranscriptFlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        layout(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let result = layout(
            proposal: ProposedViewSize(width: bounds.width, height: proposal.height),
            subviews: subviews
        )
        for (index, point) in result.points.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y),
                anchor: .topLeading,
                proposal: .unspecified
            )
        }
    }

    private func layout(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, points: [CGPoint]) {
        let width = proposal.width ?? 480
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var points: [CGPoint] = []
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            points.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return (CGSize(width: width, height: y + rowHeight), points)
    }
}

private struct FeatureWorkbench: View {
    let tab: WorkbenchTab

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: tab.icon)
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(Color.yapperOrange)
            Text(tab.rawValue)
                .font(.system(size: 15, weight: .bold))
            Text("This tool will attach directly to native timeline tracks.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

func formatTime(_ seconds: Double) -> String {
    guard seconds.isFinite else { return "0:00" }
    let total = max(0, Int(seconds.rounded()))
    return String(format: "%d:%02d", total / 60, total % 60)
}
