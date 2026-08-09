import Foundation
import Testing

@testable import YapperNative

/// Where a drag lands. The preview and the edit both read this, so if it is
/// wrong the clip goes somewhere other than the spot the creator was shown.
@Suite struct TimelineDropTests {
    /// A project with two overlay lanes above the speaker, no text, no captions.
    private let rows = TimelineRowLayout(overlayTrackCount: 2)
    private let bare = TimelineRowLayout()

    // MARK: - Which row

    @Test func stayingOverItsOwnRowIsAReorder() {
        let track = TimelineDropGeometry.track(
            atY: rows.clipRowY + 20,
            rows: rows,
            canLift: true
        )
        #expect(track == .video(insertionIndex: 0))
    }

    /// The gap between the video row and the lane above it is slack, not a
    /// trigger: a wobble on the way past must not change what the drop means.
    @Test func aWobbleJustAboveTheRowIsStillAReorder() {
        let track = TimelineDropGeometry.track(
            atY: rows.clipRowY - TimelineDropGeometry.liftMargin + 1,
            rows: rows,
            canLift: true
        )
        #expect(track == .video(insertionIndex: 0))
    }

    @Test func climbingOntoALaneAimsAtThatLane() {
        // Lane 0 sits closest to the speaker, so its row is the lower one.
        let lower = TimelineDropGeometry.track(
            atY: rows.overlayRowY(track: 0) + 4,
            rows: rows,
            canLift: true
        )
        let upper = TimelineDropGeometry.track(
            atY: rows.overlayRowY(track: 1) + 4,
            rows: rows,
            canLift: true
        )
        #expect(lower == .overlay(lane: 0, isNew: false))
        #expect(upper == .overlay(lane: 1, isNew: false))
    }

    @Test func climbingAboveTheStackStartsANewLane() {
        let track = TimelineDropGeometry.track(
            atY: rows.overlayStackTop - 6,
            rows: rows,
            canLift: true
        )
        #expect(track == .overlay(lane: 2, isNew: true))
    }

    @Test func theFirstLiftOfAllStartsTheFirstLane() {
        let track = TimelineDropGeometry.track(
            atY: bare.clipRowY - 40,
            rows: bare,
            canLift: true
        )
        #expect(track == .overlay(lane: 0, isNew: true))
    }

    /// The last clip cannot be lifted off the video track, so no amount of
    /// climbing should offer to.
    @Test func aTimelineOfOneClipNeverLifts() {
        let track = TimelineDropGeometry.track(
            atY: 0,
            rows: rows,
            canLift: false
        )
        #expect(track == .video(insertionIndex: 0))
    }

    // MARK: - Where along it

    private func target(
        y: Double,
        leadingEdgeTime: Double,
        snapAnchors: [TimelineSnapAnchor] = [],
        stationaryDurations: [Double] = [4, 4]
    ) -> TimelineDropTarget {
        TimelineDropGeometry.target(
            pointerY: y,
            leadingEdgeTime: leadingEdgeTime,
            duration: 2,
            rows: rows,
            stationaryDurations: stationaryDurations,
            projectDuration: 10,
            contentWidth: 1000,
            snapAnchors: snapAnchors,
            isSnappingEnabled: true,
            canLift: true
        )
    }

    @Test func anOverlayLandsWhereItWasDropped() {
        let dropped = target(y: rows.overlayRowY(track: 1) + 4, leadingEdgeTime: 3.5)
        #expect(dropped.start == 3.5)
        #expect(dropped.overlayLane == 1)
    }

    @Test func anOverlayCannotBeDroppedOffTheEnds() {
        #expect(target(y: rows.overlayRowY(track: 0), leadingEdgeTime: -4).start == 0)
        // Ten seconds long, two seconds of clip: the latest start is eight.
        #expect(target(y: rows.overlayRowY(track: 0), leadingEdgeTime: 40).start == 8)
    }

    @Test func aDroppedOverlaySnapsToTheGuidesNearIt() {
        let anchors = [TimelineSnapAnchor(time: 4, kind: .playhead)]
        let dropped = target(
            y: rows.overlayRowY(track: 0),
            leadingEdgeTime: 3.97,
            snapAnchors: anchors
        )
        #expect(dropped.start == 4)
        #expect(dropped.snap?.kind == .playhead)
    }

    /// The end of the item snaps too, which is what makes a cutaway sit flush
    /// against the cut it is covering.
    @Test func theTrailingEdgeSnapsAsWellAsTheLeading() {
        let anchors = [TimelineSnapAnchor(time: 6, kind: .boundary)]
        let dropped = target(
            y: rows.overlayRowY(track: 0),
            leadingEdgeTime: 4.03,
            snapAnchors: anchors
        )
        #expect(abs(dropped.start - 4) < 0.000_1)
        #expect(dropped.snap?.kind == .boundary)
    }

    /// The video track is magnetic, so a drop there picks a position in the
    /// order rather than a time.
    @Test func aReorderPicksAnIndexNotATime() {
        let early = target(y: rows.clipRowY, leadingEdgeTime: 1)
        let late = target(y: rows.clipRowY, leadingEdgeTime: 7)
        #expect(early.track == .video(insertionIndex: 0))
        #expect(late.track == .video(insertionIndex: 2))
    }

    @Test func snappingCanBeTurnedOff() {
        let dropped = TimelineDropGeometry.target(
            pointerY: rows.overlayRowY(track: 0),
            leadingEdgeTime: 3.97,
            duration: 2,
            rows: rows,
            stationaryDurations: [],
            projectDuration: 10,
            contentWidth: 1000,
            snapAnchors: [TimelineSnapAnchor(time: 4, kind: .playhead)],
            isSnappingEnabled: false,
            canLift: true
        )
        #expect(dropped.start == 3.97)
        #expect(dropped.snap == nil)
    }
}

/// Lifting a clip off the speaker's track and onto a lane.
@Suite struct ClipPromotionTests {
    private let mediaID = UUID()

    private func project() -> EditorProject {
        EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(filePath: "/tmp/promote.mp4"),
                    name: "promote.mp4",
                    duration: 30,
                    width: 1920,
                    height: 1080,
                    hasAudio: true
                ),
            ],
            clips: [
                TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 4),
                TimelineClip(mediaID: mediaID, sourceStart: 4, sourceEnd: 8),
                TimelineClip(mediaID: mediaID, sourceStart: 8, sourceEnd: 12),
            ]
        )
    }

    @Test func aLiftedClipLandsWhereItWasDropped() throws {
        var subject = project()
        let id = subject.clips[1].id

        let promoted = subject.promoteClipToOverlay(id, start: 2.5, lane: 1)
        let overlay = try #require(promoted)

        #expect(overlay.timelineStart == 2.5)
        #expect(overlay.lane == 1)
        #expect(overlay.duration == 4)
        // It left the video track, which closes up behind it.
        #expect(subject.clips.count == 2)
        #expect(subject.duration == 8)
    }

    /// Without a drop position it keeps playing where it was.
    @Test func liftingWithoutAPositionKeepsItsPlace() throws {
        var subject = project()
        let id = subject.clips[0].id

        let promoted = subject.promoteClipToOverlay(id)
        let overlay = try #require(promoted)

        #expect(overlay.timelineStart == 0)
    }

    /// The last clip used to be impossible to lift: the room was measured after
    /// it had already been taken out, so there was never any left.
    @Test func theLastClipCanBeLifted() throws {
        var subject = project()
        let id = subject.clips[2].id

        let promoted = subject.promoteClipToOverlay(id)
        let overlay = try #require(promoted)

        #expect(subject.clips.count == 2)
        #expect(overlay.duration == 4)
        // Eight seconds of track left, so a four second overlay ends flush.
        #expect(overlay.timelineStart == 4)
    }

    @Test func aLaneIsChosenWhenNoneIsAsked() throws {
        var subject = project()
        let firstPromoted = subject.promoteClipToOverlay(subject.clips[1].id, start: 0)
        let first = try #require(firstPromoted)
        #expect(first.lane == 0)

        // The lowest lane is busy at that moment, so the next one takes it.
        let secondPromoted = subject.promoteClipToOverlay(subject.clips[1].id, start: 0)
        let second = try #require(secondPromoted)
        #expect(second.lane == 1)
    }

    @Test func theLastClipCannotBeLifted() {
        var subject = project()
        subject.clips = [subject.clips[0]]
        #expect(subject.promoteClipToOverlay(subject.clips[0].id, start: 0, lane: 0) == nil)
    }

    /// The clip keeps its whole length and slides back inside the shortened
    /// track, rather than being silently cut down to whatever room was left.
    @Test func aDropPastTheEndSlidesBackInsteadOfTruncating() throws {
        var subject = project()
        let id = subject.clips[1].id

        let promoted = subject.promoteClipToOverlay(id, start: 99)
        let overlay = try #require(promoted)

        #expect(subject.duration == 8)
        #expect(overlay.duration == 4)
        #expect(overlay.timelineStart == 4)
    }
}

/// Dropping an overlay back onto the speaker's track, the inverse of lifting
/// one off it.
@Suite struct OverlayDemotionTests {
    private let mediaID = UUID()

    private func project() -> EditorProject {
        var subject = EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(filePath: "/tmp/demote.mp4"),
                    name: "demote.mp4",
                    duration: 30,
                    width: 1920,
                    height: 1080,
                    hasAudio: true
                ),
            ],
            clips: [
                TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 4),
                TimelineClip(mediaID: mediaID, sourceStart: 4, sourceEnd: 8),
            ]
        )
        subject.overlays = [
            ProjectOverlay(
                mediaID: mediaID,
                timelineStart: 1,
                duration: 3,
                sourceStart: 20
            ),
        ]
        return subject
    }

    @Test func anOverlayBecomesACutWhereItWasDropped() throws {
        var subject = project()
        let id = try #require(subject.overlays?.first?.id)

        let demoted = subject.demoteOverlayToClip(id, insertionIndex: 1)
        let clip = try #require(demoted)

        #expect(subject.overlays?.isEmpty == true)
        #expect(subject.clips.count == 3)
        #expect(subject.clips[1].id == clip.id)
        // It keeps the footage it was showing, not the seconds it sat over.
        #expect(clip.sourceStart == 20)
        #expect(clip.duration == 3)
        #expect(subject.duration == 11)
    }

    @Test func anIndexPastTheEndLandsItLast() throws {
        var subject = project()
        let id = try #require(subject.overlays?.first?.id)

        let demoted = subject.demoteOverlayToClip(id, insertionIndex: 99)
        let clip = try #require(demoted)

        #expect(subject.clips.last?.id == clip.id)
    }

    @Test func anOverlayWhoseMediaIsGoneIsLeftAlone() throws {
        var subject = project()
        let id = try #require(subject.overlays?.first?.id)
        subject.media = []

        #expect(subject.demoteOverlayToClip(id, insertionIndex: 0) == nil)
        #expect(subject.overlays?.count == 1)
    }
}
