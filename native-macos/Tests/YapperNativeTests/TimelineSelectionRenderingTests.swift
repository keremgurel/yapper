import Foundation
import Testing
@testable import YapperNative

@MainActor
struct TimelineSelectionRenderingTests {
    @Test("Selection participates in the timeline content render boundary")
    func selectionInvalidatesEquatableTimelineContent() {
        let session = EditorSession()
        let id = UUID()
        let unselected = TimelineContent(
            session: session,
            contentWidth: 1_000,
            timelineSelection: [],
            visibleRange: 0 ... 10
        )
        let selected = TimelineContent(
            session: session,
            contentWidth: 1_000,
            timelineSelection: [.caption(id)],
            visibleRange: 0 ... 10
        )

        #expect(unselected != selected)
    }

    @Test("An unchanged selection keeps the timeline render cache")
    func unchangedSelectionRemainsEqual() {
        let session = EditorSession()
        let id = UUID()
        let first = TimelineContent(
            session: session,
            contentWidth: 1_000,
            timelineSelection: [.overlay(id)],
            visibleRange: 0 ... 10
        )
        let second = TimelineContent(
            session: session,
            contentWidth: 1_000,
            timelineSelection: [.overlay(id)],
            visibleRange: 0 ... 10
        )

        #expect(first == second)
    }
}
