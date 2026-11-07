import Darwin
import Foundation
import Testing
@testable import YapperNative

/// A move onto a real second volume: an exFAT disk image standing in for a
/// USB stick.
@Suite(.serialized, .enabled(if: FileManager.default.isExecutableFile(atPath: "/usr/bin/hdiutil")))
struct ProjectMoverDriveTests {
    private struct DiskImage {
        let mount: URL

        static func attach(format: String, in root: URL) throws -> DiskImage {
            let image = root.appending(path: "stick.dmg")
            let mount = root.appending(path: "mount", directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: mount, withIntermediateDirectories: true)
            try hdiutil(["create", "-size", "24m", "-fs", format, "-volname", "YapperTestStick", image.path, "-quiet"])
            try hdiutil(["attach", image.path, "-nobrowse", "-mountpoint", mount.path, "-quiet"])
            return DiskImage(mount: mount)
        }

        func detach() {
            try? Self.hdiutil(["detach", mount.path, "-force", "-quiet"])
        }

        private static func hdiutil(_ arguments: [String]) throws {
            let process = Process()
            process.executableURL = URL(filePath: "/usr/bin/hdiutil")
            process.arguments = arguments
            try process.run()
            process.waitUntilExit()
            guard process.terminationStatus == 0 else {
                throw CocoaError(.fileWriteUnknown, userInfo: [NSLocalizedDescriptionKey: "hdiutil \(arguments.first ?? "") failed"])
            }
        }
    }

    @Test("A move to an exFAT stick ignores the ._ file the stick adds for a quarantined take")
    func exFATStickWithQuarantinedTake() throws {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "ProjectMoverDriveTests-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let package = ProjectPackage(url: root.appending(path: "Mac/Day 25.yapperproj", directoryHint: .isDirectory))
        let recordings = package.url.appending(path: "recordings", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: recordings, withIntermediateDirectories: true)
        try Data("{\"name\":\"Day 25\"}".utf8).write(to: package.projectFileURL)
        let take = recordings.appending(path: "take.mov")
        let bytes = Data((0..<65_536).map { UInt8($0 % 251) })
        try bytes.write(to: take)
        let flag = Array("0081;00000000;Safari;".utf8)
        #expect(setxattr(take.path, "com.apple.quarantine", flag, flag.count, 0, 0) == 0)

        let stick = try DiskImage.attach(format: "ExFAT", in: root)
        defer { stick.detach() }
        #expect(!StorageVolume.sameVolume(package.url, stick.mount))

        var trashed: [URL] = []
        let moved = try #require(try ProjectMover.move(package, into: stick.mount, trash: { url in
            trashed.append(url)
            try FileManager.default.removeItem(at: url)
        }))
        #expect(moved.originalInTrash)
        #expect(trashed == [package.url])
        let landed = moved.to.appending(path: "recordings/take.mov")
        #expect(try Data(contentsOf: landed) == bytes)
        #expect(FileManager.default.fileExists(atPath: moved.to.appending(path: "recordings/._take.mov").path))
        let leftovers = try FileManager.default.contentsOfDirectory(atPath: stick.mount.path)
            .filter { $0.hasPrefix(ProjectMoveStaging.prefix) }
        #expect(leftovers.isEmpty)
    }
}
