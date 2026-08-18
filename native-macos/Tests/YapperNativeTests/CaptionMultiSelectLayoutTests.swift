import Foundation
import Testing

@testable import YapperNative

/// Marquee a run of cards on the caption track, drag one of them where you want
/// it on the preview, and the run goes with it. Anything else means placing a
/// hundred cards one at a time.
@MainActor
@Suite struct CaptionMultiSelectLayoutTests {
    private func session() async -> EditorSession {
        let session = EditorSession(store: QuietLayoutStore())
        // The session restores on a task of its own, and an edit scheduled
        // while that is still running is dropped on the floor.
        for _ in 0 ..< 500 where session.isBusy { await Task.yield() }
        let mediaID = UUID()
        session.updateProject { project in
            project.media = [ProjectMedia(
                id: mediaID,
                url: URL(filePath: "/tmp/caption-layout.mov"),
                name: "caption-layout.mov",
                duration: 4,
                width: 1080,
                height: 1920,
                hasAudio: true
            )]
            project.clips = [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 4)]
            project.transcript = [
                TranscriptWord(mediaID: mediaID, text: "one", start: 0.10, end: 0.30),
                TranscriptWord(mediaID: mediaID, text: "two", start: 0.40, end: 0.60),
                TranscriptWord(mediaID: mediaID, text: "three", start: 0.70, end: 0.90),
                TranscriptWord(mediaID: mediaID, text: "four", start: 1.00, end: 1.20),
            ]
            project.captionWordsPerCard = 1
            project.regenerateCaptions()
        }
        // The ask is about restyling a selection, so these run with
        // Apply-to-all off. With it on every card moves regardless.
        if session.captionApplyToAll { session.toggleCaptionApplyToAll() }
        return session
    }

    private func marquee(_ session: EditorSession, _ captions: [ProjectCaption]) {
        session.setTimelineSelection(Set(captions.map { TimelineSelectionItem.caption($0.id) }))
    }

    private func position(_ session: EditorSession, _ id: UUID) -> (x: Double?, y: Double?) {
        let caption = session.captions.first { $0.id == id }
        return (caption?.overrides.x, caption?.overrides.y)
    }

    @Test func aMarqueeSelectsEveryCardItCovers() async {
        let session = await session()
        let cards = session.captions
        #expect(cards.count == 4)

        marquee(session, cards)

        #expect(session.selectedCaptionIDs == Set(cards.map(\.id)))
    }

    @Test func draggingOneSelectedCardPlacesThemAll() async {
        let session = await session()
        let cards = session.captions
        marquee(session, cards)

        session.moveCaption(cards[1].id, x: 0.32, y: 0.18)

        for card in cards {
            let moved = position(session, card.id)
            #expect(moved.x == 0.32)
            #expect(moved.y == 0.18)
        }
    }

    /// Dragging a card outside the selection is how that card gets picked up,
    /// so it becomes the selection and nothing else moves.
    @Test func draggingACardOutsideTheSelectionMovesOnlyIt() async {
        let session = await session()
        let cards = session.captions
        marquee(session, Array(cards.prefix(2)))

        session.moveCaption(cards[3].id, x: 0.4, y: 0.9)

        #expect(session.selectedCaptionIDs == [cards[3].id])
        #expect(position(session, cards[3].id).x == 0.4)
        for card in cards.prefix(3) {
            #expect(position(session, card.id).x == nil)
        }
    }

    @Test func widthFollowsTheSameSelection() async {
        let session = await session()
        let cards = session.captions
        marquee(session, cards)

        session.resizeCaption(cards[0].id, width: 0.55)

        #expect(session.captions.allSatisfy { $0.overrides.width == 0.55 })
    }

    /// With Apply-to-all on, a drag is the shared position and no card picks up
    /// an override that would shadow it later.
    @Test func applyToAllStillWritesTheSharedPosition() async {
        let session = await session()
        let cards = session.captions
        marquee(session, cards)
        session.toggleCaptionApplyToAll()
        #expect(session.captionApplyToAll)

        session.moveCaption(cards[0].id, x: 0.25, y: 0.75)

        #expect(session.captionStyle.x == 0.25)
        #expect(session.captionStyle.y == 0.75)
        #expect(session.captions.allSatisfy { $0.overrides.x == nil })
    }
}

private actor QuietLayoutStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}
