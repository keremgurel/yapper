import SwiftUI

/// One caption card on the timeline: what it says, when it says it, and the
/// handles to change that.
///
/// Cards are anchored in the recording rather than on the timeline, so this
/// works on a draft span while the drag is running and writes the new timing
/// back to the card only when the gesture ends.
struct TimelineCaptionCell: View {
    /// Held, not observed. A cell that subscribes to the session is rebuilt
    /// whenever anything in the editor changes, so typing in one caption used
    /// to re-run the body of every cell on the timeline. Everything the body
    /// draws with arrives as a value, and the reference is here only to call
    /// commands from the gestures below.
    let session: EditorSession
    @ObservedObject var drag: TimelineDragState
    let cue: ProjectCaptionCue
    let contentWidth: Double
    /// The project length the cell lays itself out against, passed in so
    /// the cell does not have to watch the session for it.
    let projectDuration: Double
    let rowY: Double
    let selected: Bool

    @State private var moveOrigin: CaptionTimelineEdit.Span?
    @State private var trimOrigin: CaptionTimelineEdit.Span?
    @State private var draft: CaptionTimelineEdit.Span?
    @State private var activeTrimEdge: HorizontalEdge?
    @State private var snapAnchors: [TimelineSnapAnchor] = []
    @State private var selectionMoveBounds: (start: Double, end: Double)?

    static let height = 34.0

    private var span: CaptionTimelineEdit.Span {
        draft ?? CaptionTimelineEdit.Span(start: cue.timelineStart, end: cue.timelineEnd)
    }

    var body: some View {
        let current = span
        let startX = contentWidth * current.start / max(0.001, projectDuration)
        let width = max(2, contentWidth * current.duration / max(0.001, projectDuration))
        RoundedRectangle(cornerRadius: 5, style: .continuous)
            .fill(Color(red: 0.13, green: 0.29, blue: 0.42).opacity(0.9))
            .overlay(alignment: .leading) {
                HStack(spacing: 5) {
                    Image(systemName: "captions.bubble")
                    Text(cue.displayText).lineLimit(1)
                }
                .font(.studioCaptionStrong)
                .foregroundStyle(Color.white.opacity(0.95))
                .padding(.horizontal, selected ? 11 : 7)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .stroke(
                        selected ? Color.yapperOrange.opacity(0.92) : Color.cyan.opacity(0.42),
                        lineWidth: selected ? 1.15 : 0.7
                    )
            }
            .contentShape(Rectangle())
            .onTapGesture { selectTimelineItemFromPointer(.caption(cue.id), session: session) }
            .contextMenu {
                PropertiesMenuItems(session: session, item: .caption(cue.id))
            }
            .frame(width: width, height: Self.height)
            .clipped()
            .gesture(moveGesture)
            .overlay(alignment: .leading) {
                if selected { trimHandle(edge: .leading) }
            }
            .overlay(alignment: .trailing) {
                if selected { trimHandle(edge: .trailing) }
            }
            .help("Drag to change when this caption shows. Its words are fixed once you move it.")
            .offset(
                x: startX + (selected
                    ? TimelineTrimGeometry.x(
                        for: drag.offset,
                        contentWidth: contentWidth,
                        projectDuration: projectDuration
                    )
                    : 0),
                y: rowY
            )
    }

    private var moveGesture: some Gesture {
        DragGesture(
            minimumDistance: 2,
            coordinateSpace: .named(TimelineContent.coordinateSpaceName)
        )
            .onChanged { value in
                guard activeTrimEdge == nil else { return }
                if moveOrigin == nil, selectionMoveBounds == nil {
                    session.ensureTimelineItemSelected(.caption(cue.id))
                    snapAnchors = session.timelineSnapAnchors()
                    if session.timelineSelection.count > 1 {
                        selectionMoveBounds = session.timelineSelectionBounds()
                    } else {
                        moveOrigin = CaptionTimelineEdit.Span(
                            start: cue.timelineStart,
                            end: cue.timelineEnd
                        )
                    }
                }
                if let selectionMoveBounds {
                    let move = timelineSelectionMove(
                        session: session,
                        bounds: selectionMoveBounds,
                        rawTranslationX: value.location.x - value.startLocation.x,
                        contentWidth: contentWidth,
                        snapAnchors: snapAnchors
                    )
                    session.previewTimelineSelectionMove(delta: move.delta)
                    session.setActiveTimelineSnap(move.match)
                    return
                }
                guard let moveOrigin else { return }
                let rawTranslation = value.location.x - value.startLocation.x
                let rawDraft = CaptionTimelineEdit.moved(
                    span: moveOrigin,
                    translationX: rawTranslation,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                let adjusted = TimelineSnapDragGeometry.moveTranslation(
                    originalStart: moveOrigin.start,
                    proposedStart: rawDraft.start,
                    duration: rawDraft.duration,
                    rawTranslationX: rawTranslation,
                    anchors: snapAnchors,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration,
                    enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                )
                draft = CaptionTimelineEdit.moved(
                    span: moveOrigin,
                    translationX: adjusted.translationX,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                session.setActiveTimelineSnap(adjusted.match)
            }
            .onEnded { _ in
                if selectionMoveBounds != nil {
                    selectionMoveBounds = nil
                    finishGesture()
                    Task { await session.commitTimelineSelectionMove() }
                    return
                }
                commitDraft()
                moveOrigin = nil
                finishGesture()
            }
    }

    private func trimHandle(edge: HorizontalEdge) -> some View {
        let current = span
        let edgeTime = edge == .leading ? current.start : current.end
        return TimelineTrimHandle(
            edge: edge,
            height: Self.height - 4,
            isActive: activeTrimEdge == edge,
            readout: activeTrimEdge == edge ? formatTimelineTrimTime(edgeTime) : nil
        )
            .highPriorityGesture(
                DragGesture(
                    minimumDistance: 0,
                    coordinateSpace: .named(TimelineContent.coordinateSpaceName)
                )
                    .onChanged { value in
                        if trimOrigin == nil {
                            trimOrigin = CaptionTimelineEdit.Span(
                                start: cue.timelineStart,
                                end: cue.timelineEnd
                            )
                            activeTrimEdge = edge
                            snapAnchors = session.timelineSnapAnchors()
                            session.ensureTimelineItemSelected(.caption(cue.id))
                        }
                        guard let trimOrigin else { return }
                        let rawTranslation = value.location.x - value.startLocation.x
                        let rawDraft = CaptionTimelineEdit.trimmed(
                            span: trimOrigin,
                            edge: edge == .leading ? .leading : .trailing,
                            translationX: rawTranslation,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration
                        )
                        let adjusted = TimelineSnapDragGeometry.trimTranslation(
                            originalEdgeTime: edge == .leading ? trimOrigin.start : trimOrigin.end,
                            proposedEdgeTime: edge == .leading ? rawDraft.start : rawDraft.end,
                            rawTranslationX: rawTranslation,
                            anchors: snapAnchors,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration,
                            enabled: session.isTimelineSnappingEnabled && !isTimelineSnapTemporarilyBypassed
                        )
                        draft = CaptionTimelineEdit.trimmed(
                            span: trimOrigin,
                            edge: edge == .leading ? .leading : .trailing,
                            translationX: adjusted.translationX,
                            contentWidth: contentWidth,
                            projectDuration: projectDuration
                        )
                        session.setActiveTimelineSnap(adjusted.match)
                    }
                    .onEnded { _ in
                        commitDraft()
                        trimOrigin = nil
                        activeTrimEdge = nil
                        finishGesture()
                    }
            )
            .help(edge == .leading ? "Change when this caption appears" : "Change when it leaves")
    }

    private func commitDraft() {
        guard let draft else { return }
        session.retimeCaption(cue.id, timelineStart: draft.start, end: draft.end)
    }

    private func finishGesture() {
        draft = nil
        snapAnchors = []
        session.setActiveTimelineSnap(nil)
    }
}
