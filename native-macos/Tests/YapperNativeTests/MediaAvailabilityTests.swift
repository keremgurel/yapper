import Foundation
import Testing
@testable import YapperNative

/// Noticing that a project's footage has walked off, which is the difference
/// between a black preview and a black preview that says why.
struct MediaAvailabilityTests {
    private func media(_ path: String) -> ProjectMedia {
        ProjectMedia(
            url: URL(filePath: path),
            name: URL(filePath: path).lastPathComponent,
            duration: 10,
            width: 1_920,
            height: 1_080,
            hasAudio: true
        )
    }

    @Test func onlyTheUnreachableFilesAreReported() {
        let here = media("/Volumes/Card/ep8.mp4")
        let gone = media("/Volumes/Card/broll.mp4")
        let missing = MediaAvailability.missing(in: [here, gone]) { url in
            url.path == here.url.path
        }
        #expect(missing.map(\.id) == [gone.id])
    }

    @Test func aProjectWhoseFilesAreAllThereReportsNothing() {
        #expect(MediaAvailability.missing(in: [media("/tmp/a.mov")]) { _ in true }.isEmpty)
    }

    @Test func aRemovableVolumeIsNamedSoItCanBeReconnected() {
        #expect(MediaAvailability.volumeName(of: URL(filePath: "/Volumes/G MicroSD/DCIM/a.mp4")) == "G MicroSD")
    }

    @Test func aFileOnTheStartupDiskHasNoVolumeToReconnect() {
        #expect(MediaAvailability.volumeName(of: URL(filePath: "/Users/me/Movies/a.mp4")) == nil)
        #expect(MediaAvailability.volumeName(of: URL(filePath: "/Volumes")) == nil)
    }
}

/// An edit outlives the footage being unreachable. This is the rule that used
/// to be broken: reopening the app with the card out dropped the media, and
/// with it every clip, caption and transcript word that referred to it.
@MainActor
struct OfflineMediaSurvivalTests {
    @Test func aProjectKeepsItsCutsWhenTheFootageIsAway() throws {
        let mediaID = UUID()
        let project = EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(filePath: "/Volumes/Gone/ep8.mp4"),
                    name: "ep8.mp4",
                    duration: 60,
                    width: 1_080,
                    height: 1_920,
                    hasAudio: true
                ),
            ],
            clips: [
                TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 4),
                TimelineClip(mediaID: mediaID, sourceStart: 9, sourceEnd: 12),
            ],
            transcript: [TranscriptWord(mediaID: mediaID, text: "hello", start: 0, end: 0.4)]
        )

        // Whatever the session does about the missing file, it must not be to
        // forget the edit.
        let session = EditorSession()
        session.updateProject { $0 = project }

        #expect(session.project.clips.count == 2)
        #expect(session.project.transcript?.count == 1)
        #expect(session.project.media.count == 1)
    }

    @Test func theSummaryNamesTheVolumeToReconnect() {
        let watcher = MediaAvailabilityWatcher()
        #expect(watcher.isEverythingAvailable)
        #expect(watcher.offline.isEmpty)
    }
}
