import AppKit
import CoreGraphics
import Foundation
import Testing

@testable import YapperNative

/// Getting one caption or one cutaway right is work. Doing that work again on
/// every other one is not editing, so the look is copied whole and pasted onto
/// whatever is selected.
@MainActor
@Suite struct CopyPropertiesTests {
    private let mediaID = UUID()

    private func session(url: URL) async -> EditorSession {
        let session = EditorSession(store: QuietPropertiesStore())
        for _ in 0 ..< 500 where session.isBusy { await Task.yield() }
        session.updateProject { project in
            project.media = [ProjectMedia(
                id: mediaID,
                url: url,
                name: url.lastPathComponent,
                duration: 4,
                width: 160,
                height: 90,
                hasAudio: false
            )]
            project.clips = [
                TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 1),
                TimelineClip(mediaID: mediaID, sourceStart: 1, sourceEnd: 2),
                TimelineClip(mediaID: mediaID, sourceStart: 2, sourceEnd: 3),
            ]
            project.overlays = [
                ProjectOverlay(mediaID: self.mediaID, timelineStart: 0, duration: 1),
                ProjectOverlay(mediaID: self.mediaID, timelineStart: 1, duration: 1),
            ]
            project.transcript = [
                TranscriptWord(mediaID: self.mediaID, text: "one", start: 0.10, end: 0.30),
                TranscriptWord(mediaID: self.mediaID, text: "two", start: 0.40, end: 0.60),
                TranscriptWord(mediaID: self.mediaID, text: "three", start: 0.70, end: 0.90),
            ]
            project.captionWordsPerCard = 1
            project.regenerateCaptions()
        }
        if session.captionApplyToAll { session.toggleCaptionApplyToAll() }
        return session
    }

    private func movie() async throws -> URL {
        let url = URL(filePath: NSTemporaryDirectory())
            .appending(path: "copy-properties-\(UUID().uuidString).mov")
        try await SyntheticVideo.write(
            color: NSColor.black.cgColor,
            size: CGSize(width: 160, height: 90),
            seconds: 4,
            to: url
        )
        return url
    }

    @Test func aCaptionsLookLandsOnEverySelectedCard() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await session(url: url)
        let cards = session.captions
        session.setSelectedCaptionIDs([cards[0].id])
        session.setCaptionStyle(TextStylePatch(x: 0.2, y: 0.3, width: 0.4))

        session.copyProperties(of: .caption(cards[0].id))
        session.setSelectedCaptionIDs([cards[1].id, cards[2].id])
        session.pasteProperties(onto: .caption(cards[1].id))

        let after = session.captions
        #expect(after[1].overrides.x == 0.2)
        #expect(after[1].overrides.y == 0.3)
        #expect(after[2].overrides.x == 0.2)
        #expect(after[2].overrides.width == 0.4)
    }

    /// Pasting onto a card that is not part of the selection lands on that card
    /// alone, the same rule dragging follows.
    @Test func pastingOutsideTheSelectionLandsOnOneCard() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await session(url: url)
        let cards = session.captions
        session.setSelectedCaptionIDs([cards[0].id])
        session.setCaptionStyle(TextStylePatch(x: 0.2))
        session.copyProperties(of: .caption(cards[0].id))
        session.setSelectedCaptionIDs([cards[1].id])

        session.pasteProperties(onto: .caption(cards[2].id))

        let after = session.captions
        #expect(after[2].overrides.x == 0.2)
        #expect(after[1].overrides.x == nil)
    }

    @Test func aCutawaysLookLandsOnTheSelection() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await session(url: url)
        var first = session.overlays[0]
        first.x = 0.2
        first.y = 0.8
        first.width = 0.44
        first.height = 0.44
        first.crop = OverlayCrop(x: 0.1, y: 0.1, width: 0.8, height: 0.8)
        session.commitOverlayEdit(first)

        session.copyProperties(of: .overlay(first.id))
        let second = session.overlays[1]
        session.setTimelineSelection([.overlay(second.id)])
        session.pasteProperties(onto: .overlay(second.id))

        let after = session.overlays[1]
        #expect(after.x == 0.2)
        #expect(after.height == 0.44)
        #expect(after.crop == first.crop)
        // Timing is what makes it that cutaway, so it stays where it was.
        #expect(after.timelineStart == 1)
        #expect(after.duration == 1)
    }

    @Test func aClipsFramingLandsOnTheSelection() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await session(url: url)
        let clips = session.project.clips
        session.setTimelineSelection([.clip(clips[0].id)])
        session.commitFraming(VideoFraming(scale: 1.5, x: 0.05, y: -0.1), clipID: clips[0].id)

        session.copyProperties(of: .clip(clips[0].id))
        session.setTimelineSelection([.clip(clips[1].id), .clip(clips[2].id)])
        session.pasteProperties(onto: .clip(clips[1].id))

        #expect(session.project.clips[1].framing?.scale == 1.5)
        #expect(session.project.clips[2].framing?.x == 0.05)
    }

    /// A caption's look means nothing to a cutaway, so the menu does not offer
    /// it and a paste through the API does nothing.
    @Test func aLookOnlyPastesOntoItsOwnKind() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await session(url: url)
        let card = session.captions[0]
        session.copyProperties(of: .caption(card.id))
        let overlay = session.overlays[0]

        #expect(session.pastePropertiesTitle(for: .overlay(overlay.id)) == nil)
        session.pasteProperties(onto: .overlay(overlay.id))

        #expect(session.overlays[0] == overlay)
    }

    @Test func theMenuSaysHowManyItWillChange() async throws {
        let url = try await movie()
        defer { try? FileManager.default.removeItem(at: url) }
        let session = await session(url: url)
        let cards = session.captions
        session.copyProperties(of: .caption(cards[0].id))
        session.setSelectedCaptionIDs(Set(cards.map(\.id)))

        #expect(session.pastePropertiesTitle(for: .caption(cards[0].id)) == "Paste properties onto 3 captions")
        session.setSelectedCaptionIDs([cards[1].id])
        #expect(session.pastePropertiesTitle(for: .caption(cards[0].id)) == "Paste properties")
    }
}

private actor QuietPropertiesStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}
