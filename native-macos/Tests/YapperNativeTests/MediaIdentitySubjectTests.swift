import Foundation
import Testing
@testable import YapperNative

/// Which files get their bytes compared when the app comes forward.
struct MediaIdentitySubjectTests {
    private func file(_ name: String, in directory: URL, bytes: [UInt8] = [1, 2, 3]) throws -> URL {
        let url = directory.appending(path: name)
        try Data(bytes).write(to: url)
        return url
    }

    private func media(_ url: URL, fingerprint: String?) -> ProjectMedia {
        ProjectMedia(
            url: url, name: url.lastPathComponent, duration: 10, width: 1_920, height: 1_080,
            hasAudio: true, sourceFingerprint: fingerprint
        )
    }

    private func temporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "yapper-identity-subject-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    @Test("Only footage the edit plays, can reach and can identify is compared")
    func onlyRequiredReachableFingerprintedFootageIsCompared() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let used = media(try file("used.mov", in: directory), fingerprint: "sha256-sampled-v1:used")
        let unused = media(try file("unused.mov", in: directory), fingerprint: "sha256-sampled-v1:unused")
        let legacy = media(try file("legacy.mov", in: directory), fingerprint: nil)
        let offline = media(directory.appending(path: "gone.mov"), fingerprint: "sha256-sampled-v1:gone")
        let project = EditorProject(
            media: [used, unused, legacy, offline],
            clips: [used, legacy, offline].map { TimelineClip(mediaID: $0.id, sourceStart: 0, sourceEnd: 5) }
        )

        let subjects = MediaIdentitySubject.required(in: project)

        guard case let .media(compared, expected)? = subjects.first, subjects.count == 1 else {
            Issue.record("Expected only the used clip, got \(subjects)")
            return
        }
        #expect(compared.id == used.id)
        #expect(expected == "sha256-sampled-v1:used")
    }

    @Test("Audio on the timeline is compared, muted audio is not")
    func timelineAudioIsComparedUnlessMuted() throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let base = media(try file("base.mov", in: directory), fingerprint: nil)
        var voice = ProjectAudioLayer(
            url: try file("voice.wav", in: directory), name: "Voice", timelineStart: 0,
            duration: 2, sourceDuration: 2
        )
        voice.sourceFingerprint = "sha256-sampled-v1:voice"
        var muted = ProjectAudioLayer(
            url: try file("muted.wav", in: directory), name: "Muted", timelineStart: 0,
            duration: 2, sourceDuration: 2
        )
        muted.sourceFingerprint = "sha256-sampled-v1:muted"
        muted.muted = true
        let project = EditorProject(
            media: [base],
            clips: [TimelineClip(mediaID: base.id, sourceStart: 0, sourceEnd: 5)],
            audioLayers: [voice, muted]
        )

        let subjects = MediaIdentitySubject.required(in: project)

        guard case let .audio(layer, _)? = subjects.first, subjects.count == 1 else {
            Issue.record("Expected only the audible layer, got \(subjects)")
            return
        }
        #expect(layer.id == voice.id)
    }

    @Test("A file is told apart from one with different bytes")
    func aFileIsToldApartFromDifferentBytes() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = try file("take.mov", in: directory, bytes: [1, 2, 3, 4])
        let fingerprint = try await MediaSourceFingerprint.compute(url: url)
        let subject = MediaIdentitySubject.media(media(url, fingerprint: fingerprint), expected: fingerprint)

        #expect(try await subject.matchesDisk())
        try Data([4, 3, 2, 1]).write(to: url)
        #expect(try await !subject.matchesDisk())
    }
}
