import CoreGraphics
import Foundation
import Testing
@testable import YapperNative

/// Where a file dragged in from Finder ends up. The row under the pointer is a
/// request, not an instruction: not everything can go on every row, and a drop
/// that lands nowhere because of it would be worse than one that lands sensibly.
struct TimelineExternalDropTests {
    private func target(_ track: TimelineDropTarget.Track, start: Double) -> TimelineDropTarget {
        TimelineDropTarget(track: track, start: start)
    }

    @Test func aVideoDroppedOnTheMainTrackJoinsTheRunningOrder() {
        let landing = TimelineExternalDrop.landing(
            for: .video,
            target: target(.video(insertionIndex: 2), start: 8),
            time: 8
        )
        #expect(landing == .clip(insertionIndex: 2))
    }

    @Test func aVideoDroppedOnALaneBecomesACutawayThere() {
        let landing = TimelineExternalDrop.landing(
            for: .video,
            target: target(.overlay(lane: 1, isNew: false), start: 12.5),
            time: 12.5
        )
        #expect(landing == .overlay(lane: 1, start: 12.5))
    }

    /// A still in the main track would be a hole in the video rather than a
    /// picture over it, so the one row an image cannot join is the one people
    /// will inevitably drop it on.
    @Test func anImageDroppedOnTheMainTrackBecomesACutawayAtThatMoment() {
        let landing = TimelineExternalDrop.landing(
            for: .image,
            target: target(.video(insertionIndex: 0), start: 0),
            time: 6.25
        )
        #expect(landing == .overlay(lane: 0, start: 6.25))
    }

    @Test func anImageDroppedOnALaneStaysOnThatLane() {
        let landing = TimelineExternalDrop.landing(
            for: .image,
            target: target(.overlay(lane: 2, isNew: true), start: 3),
            time: 3
        )
        #expect(landing == .overlay(lane: 2, start: 3))
    }

    /// There is one audio row, so a sound goes to it from wherever it was let
    /// go rather than being refused for being over the wrong one.
    @Test func aSoundGoesToTheAudioRowFromAnywhere() {
        for track in [
            TimelineDropTarget.Track.video(insertionIndex: 0),
            .overlay(lane: 0, isNew: false),
        ] {
            let landing = TimelineExternalDrop.landing(
                for: .audio,
                target: target(track, start: 0),
                time: 4.5
            )
            #expect(landing == .audio(start: 4.5))
        }
    }

    @Test func aFileThisEditorCannotOpenLandsNowhere() {
        let landing = TimelineExternalDrop.landing(
            for: .other,
            target: target(.overlay(lane: 0, isNew: false), start: 1),
            time: 1
        )
        #expect(landing == .unsupported)
    }

    @Test func nothingIsEverPlacedBeforeTheStart() {
        let landing = TimelineExternalDrop.landing(
            for: .image,
            target: target(.video(insertionIndex: 0), start: 0),
            time: -4
        )
        #expect(landing == .overlay(lane: 0, start: 0))
    }

    // MARK: - Reading what was dropped

    @Test func aFileIsClassifiedByItsExtensionWhenTheDiskWillNotSay() {
        // What an SD card straight out of a camera looks like: no content type
        // to read, because nothing has indexed it.
        #expect(TimelineExternalDrop.Kind(url: URL(filePath: "/Volumes/Card/A.MP4")) == .video)
        #expect(TimelineExternalDrop.Kind(url: URL(filePath: "/Volumes/Card/b.heic")) == .image)
        #expect(TimelineExternalDrop.Kind(url: URL(filePath: "/Volumes/Card/c.wav")) == .audio)
        #expect(TimelineExternalDrop.Kind(url: URL(filePath: "/Volumes/Card/notes.txt")) == .other)
    }

    // MARK: - Where along the timeline

    @Test func theDropTimeIsWhereThePointerIsAlongTheContent() {
        let time = TimelineExternalDropTarget.time(
            atX: 250,
            contentWidth: 1_000,
            projectDuration: 60
        )
        #expect(time == 15)
    }

    @Test func aPointerPastEitherEndIsHeldInsideTheTimeline() {
        #expect(
            TimelineExternalDropTarget.time(atX: -40, contentWidth: 1_000, projectDuration: 60) == 0
        )
        #expect(
            TimelineExternalDropTarget.time(atX: 4_000, contentWidth: 1_000, projectDuration: 60)
                == 60
        )
    }

    @Test func anEmptyTimelineHasNoSecondToDropOnto() {
        #expect(
            TimelineExternalDropTarget.time(atX: 120, contentWidth: 1_000, projectDuration: 0) == 0
        )
    }
}
