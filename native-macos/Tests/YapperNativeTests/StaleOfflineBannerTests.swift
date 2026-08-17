import Foundation
import Testing
@testable import YapperNative

/// A file the project no longer holds must stop asking to be located.
@MainActor
@Suite
struct StaleOfflineBannerTests {
    private func media(_ name: String, at path: String) -> ProjectMedia {
        ProjectMedia(
            url: URL(filePath: path),
            name: name,
            duration: 10,
            width: 1_920,
            height: 1_080,
            hasAudio: true,
            kind: .video
        )
    }

    @Test("Removing the offline clip takes its banner with it")
    func bannerGoesWithTheMedia() {
        let missing = media("hook", at: "/tmp/definitely-not-here-\(UUID().uuidString).mov")
        var project = EditorProject(
            media: [missing],
            clips: [TimelineClip(mediaID: missing.id, sourceStart: 0, sourceEnd: 5)]
        )
        let watcher = MediaAvailabilityWatcher()
        watcher.start(supplying: { project }, onRestored: {}, onResourcesChanged: {})
        #expect(!watcher.isEverythingAvailable)

        project = EditorProject()
        watcher.refreshIfSubjectsChanged()
        #expect(watcher.isEverythingAvailable)
    }

    @Test("An unchanged project is not re-checked")
    func onlyChecksWhenTheFilesChange() {
        let missing = media("hook", at: "/tmp/definitely-not-here-\(UUID().uuidString).mov")
        let project = EditorProject(
            media: [missing],
            clips: [TimelineClip(mediaID: missing.id, sourceStart: 0, sourceEnd: 5)]
        )
        let watcher = MediaAvailabilityWatcher()
        watcher.start(supplying: { project }, onRestored: {}, onResourcesChanged: {})
        let before = watcher.offlineAssets
        watcher.refreshIfSubjectsChanged()
        #expect(watcher.offlineAssets == before)
    }
}
