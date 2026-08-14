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

    @Test func inventoryBlocksOnlyReferencedVisualAndTimelineAudio() {
        let required = media("/gone/required.mov")
        let unused = media("/gone/unused.mov")
        let hidden = ProjectOverlay(
            mediaID: unused.id, timelineStart: 0, duration: 2, isHidden: true
        )
        let activeAudio = ProjectAudioLayer(
            url: URL(filePath: "/gone/voice.wav"), name: "Voice", timelineStart: 0,
            duration: 2, sourceDuration: 2
        )
        let pastAudio = ProjectAudioLayer(
            url: URL(filePath: "/gone/old.wav"), name: "Old", timelineStart: 99,
            duration: 2, sourceDuration: 2
        )
        let project = EditorProject(
            media: [required, unused],
            clips: [TimelineClip(mediaID: required.id, sourceStart: 0, sourceEnd: 5)],
            overlays: [hidden], audioLayers: [activeAudio, pastAudio]
        )

        let issues = MediaAvailability.offlineAssets(in: project, available: { _ in false })
        #expect(issues.first(where: { $0.id == .media(required.id) })?.isRequired == true)
        #expect(issues.first(where: { $0.id == .media(unused.id) })?.isRequired == false)
        #expect(issues.contains(where: { $0.id == .audio(activeAudio.id) }))
        #expect(!issues.contains(where: { $0.id == .audio(pastAudio.id) }))
    }

    @Test func inventoryDistinguishesBuiltInSavedAndExternalAudio() {
        let savedURL = AudioLibraryFolder.directory.appending(path: "saved.wav")
        let layers = [
            ProjectAudioLayer(
                url: URL(filePath: "/old/bundle.m4a"), name: "Pop", timelineStart: 0,
                duration: 1, sourceDuration: 1, builtInID: "pop", sourceKind: .builtIn
            ),
            ProjectAudioLayer(
                url: savedURL, name: "Saved", timelineStart: 0, duration: 1,
                sourceDuration: 1, sourceKind: .saved
            ),
            ProjectAudioLayer(
                url: URL(filePath: "/gone/external.wav"), name: "External", timelineStart: 0,
                duration: 1, sourceDuration: 1, sourceKind: .external
            ),
        ]
        let visual = media("/available/video.mov")
        let project = EditorProject(
            media: [visual], clips: [TimelineClip(mediaID: visual.id, sourceStart: 0, sourceEnd: 3)],
            audioLayers: layers
        )
        let issues = MediaAvailability.offlineAssets(
            in: project, available: { _ in false }, bundledAudioURL: { _ in nil }
        )
        #expect(issues.first(where: { $0.id == .audio(layers[0].id) })?.policy == .builtInAudio)
        #expect(issues.first(where: { $0.id == .audio(layers[1].id) })?.policy == .savedAudio)
        #expect(issues.first(where: { $0.id == .audio(layers[2].id) })?.policy == .externalAudio)
    }

    @Test func directoriesAreNotReadableMediaFiles() throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(!MediaAvailability.isRegularReadableFile(folder))
    }

    @Test func audioRequirementMatchesItsEffectiveTimelineAndSourceWindow() {
        let visual = media("/video.mov")
        let base = EditorProject(
            media: [visual], clips: [TimelineClip(mediaID: visual.id, sourceStart: 0, sourceEnd: 10)]
        )
        let exactEnd = ProjectAudioLayer(
            url: URL(filePath: "/a.wav"), name: "A", timelineStart: 10,
            duration: 1, sourceDuration: 1
        )
        let exhausted = ProjectAudioLayer(
            url: URL(filePath: "/b.wav"), name: "B", timelineStart: 0,
            duration: 1, sourceStart: 1, sourceDuration: 1
        )
        let partial = ProjectAudioLayer(
            url: URL(filePath: "/c.wav"), name: "C", timelineStart: -0.5,
            duration: 1, sourceStart: 0.5, sourceDuration: 1
        )
        #expect(!MediaAvailability.isRequired(exactEnd, in: base))
        #expect(!MediaAvailability.isRequired(exhausted, in: base))
        #expect(MediaAvailability.isRequired(partial, in: base))
    }

    @Test func unknownBuiltInDoesNotTrustAReadableStalePath() {
        let visual = media("/video.mov")
        let layer = ProjectAudioLayer(
            url: URL(filePath: "/readable/stale.m4a"), name: "Removed effect", timelineStart: 0,
            duration: 1, sourceDuration: 1, builtInID: "removed-effect", sourceKind: .builtIn
        )
        let project = EditorProject(
            media: [visual], clips: [TimelineClip(mediaID: visual.id, sourceStart: 0, sourceEnd: 3)],
            audioLayers: [layer]
        )
        let issues = MediaAvailability.offlineAssets(
            in: project, available: { _ in true }, bundledAudioURL: { _ in nil }
        )
        #expect(issues.map(\.id) == [.audio(layer.id)])
        #expect(issues.first?.policy == .builtInAudio)
    }

    @Test func legacyAudioLayerDecodesWithoutProvenance() throws {
        let id = UUID()
        let json = """
        {"id":"\(id.uuidString)","url":"file:///tmp/legacy.wav","name":"Legacy","timelineStart":0,"duration":1,"sourceStart":0,"volume":1}
        """
        let layer = try JSONDecoder().decode(ProjectAudioLayer.self, from: Data(json.utf8))
        #expect(layer.sourceKind == nil)
        #expect(layer.sourceFingerprint == nil)
        #expect(layer.savedAudioID == nil)
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
