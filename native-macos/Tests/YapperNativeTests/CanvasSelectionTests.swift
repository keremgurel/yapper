import Foundation
import Testing
@testable import YapperNative

/// Only one thing on the canvas wears the handles at a time. Two selections at
/// once made it impossible to tell what a drag was about to move.
@MainActor
struct CanvasSelectionTests {
    private func session(with project: EditorProject) -> EditorSession {
        let session = EditorSession()
        session.updateProject { $0 = project }
        return session
    }

    private var projectWithBoth: EditorProject {
        let mediaID = UUID()
        return EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(filePath: "/tmp/canvas.mov"),
                    name: "canvas",
                    duration: 20,
                    width: 1_080,
                    height: 1_920,
                    hasAudio: true
                ),
            ],
            clips: [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 10)],
            textLayers: [ProjectTextLayer(text: "Your hook", timelineStart: 0, duration: 4)]
        )
    }

    @Test func selectingATextLayerPutsTheCaptionDown() {
        let session = session(with: projectWithBoth)
        let captionID = UUID()
        session.setSelectedCaptionIDs([captionID])
        #expect(session.selectedCaptionIDs == [captionID])

        guard let layerID = session.project.textLayers?.first?.id else {
            Issue.record("the fixture should have a text layer")
            return
        }
        session.selectTextLayer(layerID)

        #expect(session.selectedTextLayerID == layerID)
        #expect(session.selectedCaptionIDs.isEmpty)
    }

    @Test func selectingACaptionPutsTheTextLayerDown() {
        let session = session(with: projectWithBoth)
        guard let layerID = session.project.textLayers?.first?.id else {
            Issue.record("the fixture should have a text layer")
            return
        }
        session.selectTextLayer(layerID)
        #expect(session.selectedTextLayerID == layerID)

        session.selectCaption(UUID())

        #expect(session.selectedTextLayerID == nil)
        #expect(session.selectedCaptionIDs.count == 1)
    }

    @Test func clearingTheCaptionSelectionLeavesEverythingElseAlone() {
        let session = session(with: projectWithBoth)
        guard let layerID = session.project.textLayers?.first?.id else {
            Issue.record("the fixture should have a text layer")
            return
        }
        session.selectTextLayer(layerID)
        session.setSelectedCaptionIDs([])

        #expect(session.selectedTextLayerID == layerID)
    }
}

@MainActor
struct CanvasDeselectionTests {
    @Test func clickingThePicturePutsDownWhateverWasHeld() {
        let session = EditorSession()
        let captionID = UUID()
        session.setSelectedCaptionIDs([captionID])
        #expect(!session.selectedCaptionIDs.isEmpty)

        session.clearCanvasSelection()

        #expect(session.selectedCaptionIDs.isEmpty)
        #expect(session.selectedTextLayerID == nil)
        #expect(session.selectedOverlayID == nil)
        #expect(session.timelineSelection.isEmpty)
    }

    @Test func clearingWithNothingHeldChangesNothing() {
        let session = EditorSession()
        session.clearCanvasSelection()
        #expect(session.selectedCaptionIDs.isEmpty)
        #expect(session.timelineSelection.isEmpty)
    }
}

@MainActor
struct HookPlacementTests {
    private func sessionWithFootage() -> EditorSession {
        let session = EditorSession()
        let mediaID = UUID()
        session.updateProject { project in
            project = EditorProject(
                media: [
                    ProjectMedia(
                        id: mediaID,
                        url: URL(filePath: "/tmp/hook.mov"),
                        name: "hook",
                        duration: 30,
                        width: 1_080,
                        height: 1_920,
                        hasAudio: true
                    ),
                ],
                clips: [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 30)]
            )
        }
        return session
    }

    @Test func aHookOpensTheVideoForFiveSeconds() {
        let session = sessionWithFootage()
        session.seekToTimelineTime(12)
        session.addTextLayer(asHook: true)

        let hook = session.project.textLayers?.last
        #expect(hook?.timelineStart == 0)
        #expect(hook?.duration == 5)
    }


    @Test func aHookOnAShortProjectStopsAtTheEnd() {
        let session = EditorSession()
        let mediaID = UUID()
        session.updateProject { project in
            project = EditorProject(
                media: [
                    ProjectMedia(
                        id: mediaID,
                        url: URL(filePath: "/tmp/short.mov"),
                        name: "short",
                        duration: 3,
                        width: 1_080,
                        height: 1_920,
                        hasAudio: true
                    ),
                ],
                clips: [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 3)]
            )
        }
        session.addTextLayer(asHook: true)
        #expect(session.project.textLayers?.last?.duration == 3)
    }
}

/// The placement rule itself, which a session test cannot reach: seeking needs
/// a real player item, so the playhead never moves in a unit test.
struct TextLayerPlacementTests {
    @Test func aHookOpensTheVideoWhereverThePlayheadIs() {
        let span = TextLayerPlacement.span(asHook: true, currentTime: 12, projectDuration: 30)
        #expect(span.start == 0)
        #expect(span.duration == 5)
    }

    @Test func plainTextLandsOnThePlayhead() {
        let span = TextLayerPlacement.span(asHook: false, currentTime: 12, projectDuration: 30)
        #expect(span.start == 12)
        #expect(span.duration == 5)
    }

    @Test func neitherRunsPastTheEndOfTheProject() {
        #expect(TextLayerPlacement.span(asHook: true, currentTime: 0, projectDuration: 3).duration == 3)
        let late = TextLayerPlacement.span(asHook: false, currentTime: 29.5, projectDuration: 30)
        #expect(late.start == 29.5)
        #expect(late.duration == 0.5)
    }

    @Test func anEmptyProjectStillGivesAUsableSpan() {
        let span = TextLayerPlacement.span(asHook: true, currentTime: 0, projectDuration: 0)
        #expect(span.start == 0)
        #expect(span.duration == 0.1)
    }
}
