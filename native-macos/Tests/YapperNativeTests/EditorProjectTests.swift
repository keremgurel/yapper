import Foundation
import Testing
@testable import YapperNative

struct EditorProjectTests {
    @Test func splitPreservesTotalDurationAndSourceContinuity() {
        let mediaID = UUID()
        let original = TimelineClip(
            mediaID: mediaID,
            sourceStart: 10,
            sourceEnd: 20
        )
        var project = EditorProject(clips: [original])

        let didSplit = project.split(clipID: original.id, atTimelineTime: 4)
        #expect(didSplit)
        #expect(project.clips.count == 2)
        #expect(project.duration == 10)
        #expect(project.clips[0].sourceStart == 10)
        #expect(project.clips[0].sourceEnd == 14)
        #expect(project.clips[1].sourceStart == 14)
        #expect(project.clips[1].sourceEnd == 20)
    }

    @Test func mapsEditedTimelineAcrossCuts() {
        let mediaID = UUID()
        let project = EditorProject(clips: [
            TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 2),
            TimelineClip(mediaID: mediaID, sourceStart: 8, sourceEnd: 12),
        ])

        #expect(project.clip(at: 1)?.sourceTime == 1)
        #expect(project.clip(at: 2.5)?.sourceTime == 8.5)
        #expect(project.duration == 6)
    }

    @Test func deletingAClipCollapsesTheTimeline() {
        let mediaID = UUID()
        let first = TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 2)
        let second = TimelineClip(mediaID: mediaID, sourceStart: 4, sourceEnd: 8)
        var project = EditorProject(clips: [first, second])

        let didDelete = project.delete(clipID: first.id)
        #expect(didDelete)
        #expect(project.duration == 4)
        #expect(project.clips == [second])
    }

    @Test func textLayersRoundTripAndRespectTheirTimelineWindow() throws {
        let layer = ProjectTextLayer(
            text: "A precise hook",
            timelineStart: 1.25,
            duration: 3.5,
            x: 0.4,
            y: 0.2,
            width: 0.72,
            fontScale: 0.065,
            style: .blackCard,
            font: .editorial
        )
        let project = EditorProject(textLayers: [layer])

        let encoded = try JSONEncoder().encode(project)
        let restored = try JSONDecoder().decode(EditorProject.self, from: encoded)

        #expect(restored.textLayers == [layer])
        #expect(!layer.isVisible(at: 1.24))
        #expect(layer.isVisible(at: 1.25))
        #expect(layer.isVisible(at: 4.75))
        #expect(!layer.isVisible(at: 4.76))
    }

    @MainActor
    @Test func selectingTextRequestsItsInspector() {
        let session = EditorSession()
        let layerID = UUID()

        session.selectTextLayer(layerID)

        #expect(session.selectedTextLayerID == layerID)
        #expect(session.inspectorRequest?.tool == "Text")
    }
}
