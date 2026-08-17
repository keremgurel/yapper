import Foundation
import Testing
@testable import YapperNative

/// The slivers an edit leaves behind.
///
/// A cut that ends a word early and the next one that starts a word late leave
/// a piece of clip between them with nobody speaking in it. Two frames of that
/// is not a shot, it is a flash, and on the timeline it is a clip too narrow to
/// click.
@Suite
struct GhostClipTests {
    private func project(mediaDuration: Double) -> (EditorProject, UUID) {
        var project = EditorProject()
        let media = ProjectMedia(
            url: URL(fileURLWithPath: "/tmp/take.mp4"),
            name: "take.mp4",
            duration: mediaDuration,
            width: 1080,
            height: 1920,
            hasAudio: true,
            kind: .video
        )
        project.media = [media]
        project.clips = [
            TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: mediaDuration),
        ]
        return (project, media.id)
    }

    @Test("A sliver between two cuts is not left on the timeline")
    func dropsTheGhost() {
        var (project, mediaID) = project(mediaDuration: 10)
        // Two cuts a tenth of a second apart, which is what an edit that
        // disagrees with itself by one word produces.
        project.removeSourceRanges([(1.0, 4.0), (4.1, 8.0)], for: mediaID)
        #expect(project.clips.count == 2)
        #expect(project.clips.allSatisfy { $0.duration >= EditorProject.shortestClipWorthKeeping })
    }

    @Test("A real short take still survives")
    func keepsARealClip() {
        var (project, mediaID) = project(mediaDuration: 10)
        project.removeSourceRanges([(1.0, 4.0), (4.6, 8.0)], for: mediaID)
        #expect(project.clips.count == 3)
        #expect(project.clips.contains { abs($0.duration - 0.6) < 0.001 })
    }
}
