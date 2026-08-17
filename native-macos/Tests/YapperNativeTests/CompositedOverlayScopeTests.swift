import Foundation
import Testing
@testable import YapperNative

/// Which overlays move into the composition when one of them is marked to sit
/// behind the speaker.
///
/// The first attempt moved all of them, on the grounds that a mixture would
/// break the stacking order. It does not: only the ones at or behind the marked
/// overlay have to come down, and moving the rest changed how every card in a
/// project was drawn the moment one card was switched. That is the bug these
/// are here to keep out.
struct CompositedOverlayScopeTests {
    private func project(_ overlays: [ProjectOverlay]) -> EditorProject {
        let media = ProjectMedia(
            url: URL(filePath: "/tmp/clip.mov"),
            name: "clip",
            duration: 10,
            width: 1080,
            height: 1920,
            hasAudio: true
        )
        return EditorProject(
            media: [media],
            clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 10)],
            overlays: overlays
        )
    }

    private func overlay(lane: Int, behind: Bool = false) -> ProjectOverlay {
        ProjectOverlay(
            mediaID: UUID(),
            timelineStart: 0,
            duration: 4,
            track: lane,
            behindSpeaker: behind ? true : nil
        )
    }

    @Test("Nothing is composited when nothing is marked")
    func nothingByDefault() {
        let overlays = [overlay(lane: 0), overlay(lane: 1)]
        #expect(project(overlays).compositedOverlayIDs.isEmpty)
    }

    @Test("Only the marked overlay is composited when it is the front-most")
    func onlyTheMarkedOne() {
        let behind = overlay(lane: 0, behind: true)
        let inFront = overlay(lane: 1)
        let composited = project([behind, inFront]).compositedOverlayIDs
        #expect(composited == [behind.id])
    }

    /// Anything below the marked one has to come down with it. Left painted on
    /// at the end it would cover the card that moved, which sits above it.
    @Test("Overlays behind the marked one come with it")
    func everythingBehindComesToo() {
        let bottom = overlay(lane: 0)
        let marked = overlay(lane: 1, behind: true)
        let top = overlay(lane: 2)
        let composited = project([bottom, marked, top]).compositedOverlayIDs
        #expect(composited == [bottom.id, marked.id])
        #expect(!composited.contains(top.id))
    }

    @Test("The front-most mark decides how far down the line is drawn")
    func theFrontmostMarkWins() {
        let low = overlay(lane: 0, behind: true)
        let middle = overlay(lane: 1)
        let high = overlay(lane: 2, behind: true)
        let top = overlay(lane: 3)
        let composited = project([low, middle, high, top]).compositedOverlayIDs
        #expect(composited == [low.id, middle.id, high.id])
    }

    @Test("A hidden overlay is not composited and does not drag others down")
    func hiddenOverlaysAreIgnored() {
        var hidden = overlay(lane: 2, behind: true)
        hidden.isHidden = true
        let visible = overlay(lane: 0)
        #expect(project([visible, hidden]).compositedOverlayIDs.isEmpty)
    }

    /// With the speaker's own track hidden there is nobody to hide behind, so
    /// nothing needs moving and the cheap path stands.
    @Test("Nothing is composited when the speaker is not on screen")
    func aHiddenSpeakerChangesNothing() {
        var edited = project([overlay(lane: 0, behind: true)])
        edited.videoTrackHidden = true
        #expect(edited.compositedOverlayIDs.isEmpty)
        #expect(!edited.cutsOutTheSpeaker)
    }
}
