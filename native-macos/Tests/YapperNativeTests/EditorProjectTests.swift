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

    @Test func allBuiltInSoundEffectsAreRealNonSilentAudio() {
        #expect(SoundEffectDescriptor.library.count == 10)
        #expect(Set(SoundEffectDescriptor.library.map(\.id)).count == 10)
        for effect in SoundEffectDescriptor.library {
            let samples = SoundEffectService.render(effect)
            #expect(samples.count == Int((effect.duration * SoundEffectService.sampleRate).rounded()))
            #expect((samples.map { abs($0) }.max() ?? 0) > 0.5)
        }
        #expect(SoundEffectDescriptor.library.first(where: { $0.id == "mechanical-keyboard" })?.duration == 5)
    }

    @Test func audioLayersRoundTripWithTheProject() throws {
        let layer = ProjectAudioLayer(
            url: URL(filePath: "/tmp/pop.wav"),
            name: "Pop",
            timelineStart: 1.2,
            duration: 0.22,
            volume: 0.75,
            builtInID: "pop"
        )
        let project = EditorProject(audioLayers: [layer])
        let data = try JSONEncoder().encode(project)
        let restored = try JSONDecoder().decode(EditorProject.self, from: data)
        #expect(restored.audioLayers == [layer])
    }

    @Test func canvasMoveSnapsTextToBothCenterGuides() {
        let layer = ProjectTextLayer(text: "Centered", timelineStart: 0)
        let result = TextCanvasGeometry.moved(
            layer: layer,
            origin: CGPoint(x: 0.3, y: 0.3),
            translation: CGSize(width: 197, height: 97),
            canvasSize: CGSize(width: 1_000, height: 500)
        )
        #expect(result.layer.x == 0.5)
        #expect(result.layer.y == 0.5)
        #expect(result.guides.verticalCenter)
        #expect(result.guides.horizontalCenter)
    }

    @Test func cornerResizeChangesWidthAndFontScaleTogether() {
        let layer = ProjectTextLayer(
            text: "Resizable",
            timelineStart: 0,
            x: 0.5,
            y: 0.5,
            width: 0.5,
            fontScale: 0.05
        )
        let enlarged = TextCanvasGeometry.resized(
            layer: layer,
            translation: CGSize(width: 120, height: 80),
            corner: .bottomTrailing,
            canvasSize: CGSize(width: 1_000, height: 600)
        )
        #expect(enlarged.width > layer.width)
        #expect(enlarged.fontScale > layer.fontScale)
        #expect(enlarged.x > layer.x)
        #expect(enlarged.y > layer.y)
    }

    @Test func timelineTextEdgesTrimAndExtendDuration() {
        let layer = ProjectTextLayer(text: "Hook", timelineStart: 2, duration: 4)
        let extended = TimelineTextGeometry.trimmed(
            layer: layer,
            edge: .trailing,
            translationX: 100,
            contentWidth: 1_000,
            projectDuration: 10
        )
        #expect(extended.timelineStart == 2)
        #expect(extended.duration == 5)

        let earlier = TimelineTextGeometry.trimmed(
            layer: layer,
            edge: .leading,
            translationX: -100,
            contentWidth: 1_000,
            projectDuration: 10
        )
        #expect(earlier.timelineStart == 1)
        #expect(earlier.duration == 5)
    }

    @Test func timelineVideoEdgesTrimAndRecoverSourceFrames() {
        let clip = TimelineClip(mediaID: UUID(), sourceStart: 5, sourceEnd: 10)
        let extended = TimelineClipGeometry.trimmed(
            clip: clip,
            edge: .leading,
            translationX: -100,
            contentWidth: 1_000,
            projectDuration: 10,
            mediaDuration: 30
        )
        #expect(extended.sourceStart == 4)
        #expect(extended.sourceEnd == 10)

        let trimmed = TimelineClipGeometry.trimmed(
            clip: clip,
            edge: .trailing,
            translationX: -100,
            contentWidth: 1_000,
            projectDuration: 10,
            mediaDuration: 30
        )
        #expect(trimmed.sourceStart == 5)
        #expect(trimmed.sourceEnd == 9)
    }

    @Test func timelineOverlayAndAudioUseTheSameEdgeBehavior() {
        let overlay = ProjectOverlay(
            mediaID: UUID(),
            timelineStart: 2,
            duration: 3
        )
        let overlayExtended = TimelineOverlayGeometry.trimmed(
            overlay: overlay,
            edge: .trailing,
            translationX: 100,
            contentWidth: 1_000,
            projectDuration: 10
        )
        #expect(overlayExtended.duration == 4)

        let audio = ProjectAudioLayer(
            url: URL(filePath: "/tmp/audio.wav"),
            name: "Audio",
            timelineStart: 2,
            duration: 3,
            sourceStart: 2,
            sourceDuration: 10
        )
        let audioExtended = TimelineAudioGeometry.trimmed(
            layer: audio,
            edge: .leading,
            translationX: -100,
            contentWidth: 1_000,
            projectDuration: 10
        )
        #expect(audioExtended.timelineStart == 1)
        #expect(audioExtended.sourceStart == 1)
        #expect(audioExtended.duration == 4)
    }

    @Test func timelineZoomClampsAndKeepsThePointerAnchored() {
        #expect(TimelineZoomGeometry.scaled(36, by: 2) == 72)
        #expect(TimelineZoomGeometry.scaled(230, by: 2) == 240)
        #expect(TimelineZoomGeometry.scaled(20, by: 0.2) == 18)

        let offset = TimelineZoomGeometry.anchoredOffset(
            oldOffset: 400,
            pointerX: 200,
            oldContentWidth: 1_200,
            newContentWidth: 2_400,
            viewportWidth: 600
        )
        #expect(offset == 1_000)
        // The same 50% timeline position remains under x=200 after zooming.
        #expect((offset + 200) / 2_400 == 0.5)
    }

    @Test func emptyTimelineSpaceMapsDirectlyToAClampedTimestamp() {
        #expect(TimelineMetrics.time(for: 250, duration: 10, width: 1_000) == 2.5)
        #expect(TimelineMetrics.time(for: -20, duration: 10, width: 1_000) == 0)
        #expect(TimelineMetrics.time(for: 1_200, duration: 10, width: 1_000) == 10)
    }
}
