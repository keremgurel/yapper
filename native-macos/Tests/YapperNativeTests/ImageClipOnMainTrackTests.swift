import Foundation
import Testing

@testable import YapperNative

/// A picture can sit on the main timeline, not only float over it as an
/// overlay. The old build hid the Add button for stills because the main track
/// inserts an `AVAssetTrack` and an image has none; the composition now leaves
/// an empty stretch of track and hands the still to our own compositor, which
/// already drew stills for overlays.
struct ImageClipOnMainTrackTests {
    private func project(withImage isImage: Bool, clipDuration: Double) -> EditorProject {
        let media = ProjectMedia(
            url: URL(fileURLWithPath: "/tmp/still.jpg"),
            name: "still.jpg",
            duration: 4,
            width: 1080,
            height: 720,
            hasAudio: !isImage,
            kind: isImage ? .image : .video
        )
        return EditorProject(
            media: [media],
            clips: [
                TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: clipDuration)
            ]
        )
    }

    @Test("A still on the timeline forces our own compositor")
    func stillForcesStudioCompositor() {
        // AVFoundation's compositor draws tracks and nothing else, so a project
        // holding a picture cannot use it even with no filter or matte.
        #expect(project(withImage: true, clipDuration: 4).needsStudioCompositor)
    }

    @Test("Footage alone still uses AVFoundation's compositor")
    func footageDoesNotForceStudioCompositor() {
        // The custom compositor costs real time per frame, so nothing should
        // opt into it that does not need it.
        #expect(!project(withImage: false, clipDuration: 4).needsStudioCompositor)
    }

    @Test("hasImageClip ignores images that are only imported")
    func importedImageWithoutClipDoesNotCount() {
        var project = self.project(withImage: true, clipDuration: 4)
        project.clips = []
        #expect(!project.hasImageClip)
        #expect(!project.needsStudioCompositor)
    }

    @Test("A still can be held for longer than its placeholder length")
    func stillTrimIsUnbounded() {
        // An image's `duration` is a placeholder, not a limit. Clamping to it
        // would mean a picture could never be held longer than four seconds,
        // which is the whole point of putting one on the timeline.
        let clip = TimelineClip(mediaID: UUID(), sourceStart: 0, sourceEnd: 4)
        let stretched = TimelineClipGeometry.trimmed(
            clip: clip,
            edge: .trailing,
            translationX: 400,
            contentWidth: 100,
            projectDuration: 10,
            mediaDuration: nil
        )
        #expect(stretched.sourceEnd > 4)
    }

    @Test("Footage is still clamped to the footage that exists")
    func footageTrimIsBounded() {
        let clip = TimelineClip(mediaID: UUID(), sourceStart: 0, sourceEnd: 4)
        let stretched = TimelineClipGeometry.trimmed(
            clip: clip,
            edge: .trailing,
            translationX: 400,
            contentWidth: 100,
            projectDuration: 10,
            mediaDuration: 4
        )
        #expect(stretched.sourceEnd == 4)
    }
}
