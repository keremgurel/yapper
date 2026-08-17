import Foundation
import Testing
@testable import YapperNative

/// The licence to keep the player's item and swap only the transform over it.
/// Saying yes when something structural moved would draw a composition against
/// tracks that are not there, so the interesting cases are all the noes.
struct PresentationOnlyChangeTests {
    private let mediaID = UUID()
    /// One project, copied per test. Built fresh each time it would mint new
    /// identifiers, and the answer is rightly no for a project whose clips are
    /// not the same clips.
    private let base: EditorProject

    init() {
        let mediaID = mediaID
        base = EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(fileURLWithPath: "/tmp/a.mov"),
                    name: "a",
                    duration: 30,
                    width: 1_080,
                    height: 1_920,
                    hasAudio: true
                ),
            ],
            clips: [
                TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 4),
                TimelineClip(mediaID: mediaID, sourceStart: 6, sourceEnd: 9),
            ]
        )
    }

    private func project() -> EditorProject { base }

    private func withOverlay() -> EditorProject {
        var project = base
        project.overlays = [
            ProjectOverlay(
                mediaID: mediaID,
                timelineStart: 1,
                duration: 3,
                sourceStart: 0,
                x: 0.1,
                y: 0.1,
                width: 0.5,
                height: 0.3
            ),
        ]
        return project
    }

    /// Moving a card is a transform, the same as framing a clip, and tearing
    /// the player item down for it is what made placing overlays feel like
    /// wading. 142 of 167 rebuilds on a real session were this.
    @Test func movingAnOverlayIsPresentationOnly() {
        let before = withOverlay()
        var after = before
        after.overlays?[0].y = -0.05
        after.overlays?[0].x = 0.4
        #expect(after.differsOnlyInPresentation(from: before))
    }

    @Test func croppingAnOverlayIsPresentationOnly() {
        let before = withOverlay()
        var after = before
        after.overlays?[0].crop = OverlayCrop(x: 0, y: 0.2, width: 1, height: 0.6)
        after.overlays?[0].height = 0.18
        #expect(after.differsOnlyInPresentation(from: before))
    }

    @Test func movingAnOverlayAlongTheTimelineIsNot() {
        let before = withOverlay()
        var after = before
        after.overlays?[0].timelineStart = 2
        #expect(!after.differsOnlyInPresentation(from: before))
    }

    @Test func hidingAnOverlayIsNot() {
        let before = withOverlay()
        var after = before
        after.overlays?[0].isHidden = true
        #expect(!after.differsOnlyInPresentation(from: before))
    }

    @Test func addingAnOverlayIsNot() {
        let before = withOverlay()
        var after = before
        let extra = after.overlays![0]
        after.overlays?.append(extra)
        #expect(!after.differsOnlyInPresentation(from: before))
    }

    @Test func changingAnOverlaysLaneIsNot() {
        let before = withOverlay()
        var after = before
        after.overlays?[0].track = 2
        #expect(!after.differsOnlyInPresentation(from: before))
    }

    @Test func framingOnMoreThanOneClipStillCounts() {
        var changed = project()
        changed.clips[0].framing = VideoFraming(scale: 2, x: 0.1, y: 0)
        changed.clips[1].framing = VideoFraming(scale: 1.4, x: 0, y: -0.2)
        #expect(changed.differsOnlyInPresentation(from: project()))
    }

    @Test func noChangeAtAllCounts() {
        #expect(project().differsOnlyInPresentation(from: project()))
    }

    @Test func aTimestampIsNotAChangeToThePicture() {
        var touched = project()
        touched.updatedAt = Date(timeIntervalSince1970: 999)
        #expect(touched.differsOnlyInPresentation(from: project()))
    }

    @Test func trimmingIsNotAFramingChange() {
        var trimmed = project()
        trimmed.clips[0].sourceEnd = 3
        #expect(!trimmed.differsOnlyInPresentation(from: project()))
    }

    @Test func addingOrRemovingAClipIsNotAFramingChange() {
        var longer = project()
        longer.clips.append(TimelineClip(mediaID: mediaID, sourceStart: 10, sourceEnd: 12))
        #expect(!longer.differsOnlyInPresentation(from: project()))

        var shorter = project()
        shorter.clips.removeLast()
        #expect(!shorter.differsOnlyInPresentation(from: project()))
    }

    @Test func reorderingClipsIsNotAFramingChange() {
        var reordered = project()
        reordered.clips.reverse()
        #expect(!reordered.differsOnlyInPresentation(from: project()))
    }

    @Test func aDifferentClipInTheSamePlaceIsNotAFramingChange() {
        var replaced = project()
        replaced.clips[1] = TimelineClip(mediaID: mediaID, sourceStart: 6, sourceEnd: 9)
        #expect(!replaced.differsOnlyInPresentation(from: project()))
    }

    @Test func aCutawayIsNotAFramingChange() {
        var withOverlay = project()
        withOverlay.overlays = [
            ProjectOverlay(mediaID: mediaID, timelineStart: 1, duration: 2),
        ]
        #expect(!withOverlay.differsOnlyInPresentation(from: project()))
    }

    @Test func audioAndGradeAndFrameShapeAreNotFramingChanges() {
        var muted = project()
        muted.videoTrackMuted = true
        #expect(!muted.differsOnlyInPresentation(from: project()))

        var reshaped = project()
        reshaped.aspectRatio = .square
        #expect(!reshaped.differsOnlyInPresentation(from: project()))

        var hidden = project()
        hidden.videoTrackHidden = true
        #expect(!hidden.differsOnlyInPresentation(from: project()))

        var graded = project()
        graded.visualFilter = VisualFilter(id: .warm, strength: 0.8)
        #expect(!graded.differsOnlyInPresentation(from: project()))
    }

    @Test func aFramingChangeAlongsideARealEditIsNotAShortcut() {
        var both = project()
        both.clips[0].framing = VideoFraming(scale: 2, x: 0, y: 0)
        both.clips[1].sourceEnd = 8
        #expect(!both.differsOnlyInPresentation(from: project()))
    }
}
