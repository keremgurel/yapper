import AppKit
import Combine
import Foundation
import Testing
@testable import YapperNative

private actor ActivationTestStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

/// Coming back to the app re-checks the footage. The check must not take the
/// editor away from the click that brought the app forward: a creator who
/// clicks 1-Click Edit as they switch to Yapper was told to wait for a media
/// check that their own click had started.
@Suite(.serialized)
@MainActor
struct MediaActivationCheckTests {
    @Test("Coming back to unchanged footage never holds the editor")
    func unchangedFootageNeverHoldsTheEditor() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let (session, _) = try await sessionWithFootage(in: directory)
        var held: [LongOperation] = []
        let watch = session.$activeOperation.sink { lease in
            if let lease { held.append(lease.operation) }
        }
        defer { watch.cancel() }

        await session.verifyMediaResourcesChangedOnDisk()

        #expect(held.isEmpty)
        #expect(session.mediaAvailability.isEverythingAvailable)
    }

    @Test("An action that arrives with the activation is accepted")
    func actionArrivingWithTheActivationIsAccepted() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let (session, _) = try await sessionWithFootage(in: directory)
        var held: [LongOperation] = []
        let watch = session.$activeOperation.sink { lease in
            if let lease { held.append(lease.operation) }
        }
        defer { watch.cancel() }

        NotificationCenter.default.post(name: NSApplication.didBecomeActiveNotification, object: NSApp)
        // The click is delivered a few turns of the main actor after the
        // activation, which is exactly when the check is in flight.
        for _ in 0 ..< 8 {
            await Task.yield()
            #expect(session.activeOperation == nil)
        }

        let lease = try #require(session.beginLongOperation(.oneClickEdit))
        session.endLongOperation(lease)
        // The activation's check started first, so by the time a second one
        // returns it has had its whole run too.
        await session.verifyMediaResourcesChangedOnDisk()
        #expect(held == [.oneClickEdit])
    }

    @Test("Becoming active refuses footage that was swapped while the app was away")
    func becomingActiveRefusesSwappedFootage() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let (session, video) = try await sessionWithFootage(in: directory)
        let mediaID = try #require(session.project.media.first?.id)
        try await SyntheticVideo.write(
            color: NSColor.red.cgColor,
            size: CGSize(width: 160, height: 90),
            seconds: 3,
            to: video
        )

        NotificationCenter.default.post(name: NSApplication.didBecomeActiveNotification, object: NSApp)

        try await eventually {
            session.mediaAvailability.requiredOffline.map(\.id) == [.media(mediaID)] &&
                session.activeOperation == nil
        }
    }

    @Test("Coming back to the app forgets what was validated before it left")
    func comingBackForgetsEarlierValidations() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let (session, _) = try await sessionWithFootage(in: directory)
        try await session.validateAvailableMediaIdentity()
        #expect(session.validatedMediaRevisions.count == 1)

        await session.verifyMediaResourcesChangedOnDisk()

        // A file the edit does not use right now is not read on return, so a
        // validation remembered from before must not vouch for it later.
        #expect(session.validatedMediaRevisions.isEmpty)
        #expect(session.validatedAudioRevisions.isEmpty)
    }

    @Test("Footage changed while its clip was deleted is refused when undo brings it back")
    func footageChangedWhileUnusedIsRefusedOnUndo() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let (session, video) = try await sessionWithFootage(in: directory)
        let mediaID = try #require(session.project.media.first?.id)
        session.selectedClipID = session.project.clips.first?.id
        await session.deleteSelected()
        #expect(session.project.clips.isEmpty)

        try overwriteInPlaceKeepingDates(video)
        await session.verifyMediaResourcesChangedOnDisk()
        #expect(session.mediaAvailability.isEverythingAvailable)

        await session.undo()

        #expect(session.mediaAvailability.hasIdentityMismatch(mediaID))
        #expect(session.errorMessage?.contains("same source media") == true)
    }

    @Test("Footage overwritten in place with the same size and dates is still refused")
    func footageOverwrittenInPlaceIsRefused() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let (session, video) = try await sessionWithFootage(in: directory)
        let mediaID = try #require(session.project.media.first?.id)
        let fingerprint = try #require(session.project.media.first?.sourceFingerprint)
        let before = try MediaResourceRevision(url: video, fingerprint: fingerprint)
        try overwriteInPlaceKeepingDates(video)
        #expect(try MediaResourceRevision(url: video, fingerprint: fingerprint) == before)

        await session.verifyMediaResourcesChangedOnDisk()

        #expect(session.mediaAvailability.requiredOffline.map(\.id) == [.media(mediaID)])
        #expect(session.errorMessage?.contains("same source media") == true)
        #expect(session.activeOperation == nil)
    }

    @Test("Footage swapped for another file at the same path is refused")
    func footageSwappedAtTheSamePathIsRefused() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let (session, video) = try await sessionWithFootage(in: directory)
        let mediaID = try #require(session.project.media.first?.id)

        try await SyntheticVideo.write(
            color: NSColor.red.cgColor,
            size: CGSize(width: 160, height: 90),
            seconds: 3,
            to: video
        )

        await session.verifyMediaResourcesChangedOnDisk()

        #expect(session.mediaAvailability.requiredOffline.map(\.id) == [.media(mediaID)])
        #expect(session.activeOperation == nil)
    }

    @Test("A check asked for during another operation still runs once it ends")
    func checkAskedForDuringAnotherOperationRunsAfterIt() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let (session, video) = try await sessionWithFootage(in: directory)
        let mediaID = try #require(session.project.media.first?.id)
        try await SyntheticVideo.write(
            color: NSColor.red.cgColor,
            size: CGSize(width: 160, height: 90),
            seconds: 3,
            to: video
        )
        let edit = try #require(session.beginLongOperation(.oneClickEdit))

        await session.verifyMediaResourcesChangedOnDisk()
        #expect(session.activeOperation == edit)
        #expect(session.mediaAvailability.isEverythingAvailable)

        session.endLongOperation(edit)
        try await eventually {
            session.mediaAvailability.requiredOffline.map(\.id) == [.media(mediaID)] &&
                session.activeOperation == nil
        }
    }

    /// The hardest case for a check that trusted the file's size and dates:
    /// same file, same length, modification date put back.
    private func overwriteInPlaceKeepingDates(_ url: URL) throws {
        var status = stat()
        #expect(stat(url.path, &status) == 0)
        let handle = try FileHandle(forWritingTo: url)
        try handle.seek(toOffset: 0)
        try handle.write(contentsOf: Data(repeating: 0xA5, count: 4096))
        try handle.close()
        let times = [status.st_atimespec, status.st_mtimespec]
        #expect(utimensat(AT_FDCWD, url.path, times, 0) == 0)
    }

    private func sessionWithFootage(in directory: URL) async throws -> (EditorSession, URL) {
        let video = directory.appending(path: "take.mov")
        try await SyntheticVideo.write(
            color: NSColor.black.cgColor,
            size: CGSize(width: 160, height: 90),
            seconds: 3,
            to: video
        )
        let session = EditorSession(store: ActivationTestStore())
        await session.importMedia([video])
        #expect(session.project.clips.count == 1)
        #expect(session.project.media.first?.sourceFingerprint != nil)
        #expect(session.activeOperation == nil)
        return (session, session.project.media.first?.url ?? video)
    }

    private func temporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-activation-check-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}
