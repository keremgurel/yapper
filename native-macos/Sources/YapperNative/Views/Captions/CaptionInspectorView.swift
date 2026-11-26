import SwiftUI

/// The caption styling panel.
///
/// The shape every properties panel in the editor now follows: the handful of
/// things you reach for constantly are on screen the moment the panel opens,
/// and everything else is folded into sections that are named the same as their
/// counterparts elsewhere. Position is Position whether you are moving a
/// caption, a text layer or a cutaway, and it is in the same place each time,
/// which is what lets somebody learn the panel once instead of per tab.
struct CaptionInspectorView: View {
    @ObservedObject var session: EditorSession
    @ObservedObject private var captionSelection: CaptionSelectionState

    init(session: EditorSession) {
        self.session = session
        _captionSelection = ObservedObject(wrappedValue: session.captionSelection)
    }

    private var style: TextStyle { session.editingCaptionStyle }
    private var noTarget: Bool { session.captionStylingHasNoTarget }

    private var editor: TextStyleEditor {
        TextStyleEditor(
            style: style,
            defaults: .default,
            fontScaleRange: TextAppearance.fontScaleRange,
            apply: { patch, live in session.setCaptionStyle(patch, live: live) }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            scope
            Group {
                InspectorFoldSection("Look", id: "captions.look", summary: TextTemplate.active(for: style.appearance)?.name) {
                    CaptionLookGrid(session: session, current: style.appearance) { session.applyCaptionTemplate($0) }
                }
                Divider().opacity(0.45)
                InspectorFoldSection("Adjust", id: "captions.adjust", summary: "Words, size, position, case, colour") {
                    CaptionAdjustSection(session: session, editor: editor)
                }
                Divider().opacity(0.45)
                CaptionMoreStyling(editor: editor)
            }
            .disabled(noTarget)
            .opacity(noTarget ? 0.45 : 1)
        }
    }

    /// Who a change lands on. Only shown once captions are picked; with none
    /// picked every change goes to all of them, which needs no saying.
    @ViewBuilder
    private var scope: some View {
        if !session.selectedCaptionIDs.isEmpty {
            let count = session.selectedCaptionIDs.count
            let items = Set(session.selectedCaptionIDs.map { TimelineSelectionItem.caption($0) })
            let locked = items.allSatisfy { session.isLocked($0) }
            VStack(alignment: .leading, spacing: 8) {
                InspectorSegmentedControl(
                    options: [
                        .init(value: true, label: "All captions"),
                        .init(value: false, label: "\(count) selected"),
                    ],
                    selection: session.captionApplyToAll,
                    onSelect: { session.captionApplyToAll = $0 }
                )
                .environment(\.inspectorFillsWidth, true)
                Button {
                    Task { await session.setTimelineItemsLocked(!locked, items: items) }
                } label: {
                    Label(locked ? "Unlock selected" : "Lock selected", systemImage: locked ? "lock.open" : "lock.fill")
                }
                .buttonStyle(EditorGhostButtonStyle(size: .mini))
                .disabled(!session.appActions.availability(.timelineLock, in: session).isAvailable)
            }
            .padding(.vertical, 12)
            Divider().opacity(0.45)
        }
    }
}
