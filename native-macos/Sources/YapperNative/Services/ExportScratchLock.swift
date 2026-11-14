import Darwin
import Foundation

/// Marks an export's scratch folder as in use, across processes.
///
/// The mark is an advisory `flock` on a file inside the folder. The kernel
/// drops it when the descriptor closes, including when the process crashes or
/// is killed, which is exactly when a folder gets abandoned. So a sweep that
/// can take the lock knows that no live export is still reading the folder.
final class ExportScratchLock: @unchecked Sendable {
    static let fileName = ".in-use"

    /// What a sweep found when it tried to take a folder's lock.
    enum Claim {
        /// The folder predates the lock file, so nothing can be holding it.
        case unmarked
        /// Nobody held it. The sweep now does, until it releases.
        case claimed(ExportScratchLock)
        /// A running export holds it.
        case inUse
    }

    private let descriptor: Int32
    private let lock = NSLock()
    private var released = false

    private init(descriptor: Int32) {
        self.descriptor = descriptor
    }

    deinit { release() }

    /// Creates the lock file in a folder this export just made and holds it.
    static func hold(in directory: URL) throws -> ExportScratchLock {
        let descriptor = open(path(in: directory), O_RDWR | O_CREAT | O_CLOEXEC, 0o600)
        guard descriptor >= 0 else { throw posixError() }
        guard flock(descriptor, LOCK_EX | LOCK_NB) == 0 else {
            let error = posixError()
            close(descriptor)
            throw error
        }
        return ExportScratchLock(descriptor: descriptor)
    }

    /// Tries to take the lock of a folder some other export made.
    static func claim(_ directory: URL) -> Claim {
        let descriptor = open(path(in: directory), O_RDONLY | O_CLOEXEC)
        guard descriptor >= 0 else { return errno == ENOENT ? .unmarked : .inUse }
        guard flock(descriptor, LOCK_EX | LOCK_NB) == 0 else {
            close(descriptor)
            return .inUse
        }
        return .claimed(ExportScratchLock(descriptor: descriptor))
    }

    func release() {
        let shouldClose = lock.withLock {
            guard !released else { return false }
            released = true
            return true
        }
        if shouldClose { close(descriptor) }
    }

    private static func path(in directory: URL) -> String {
        directory.appending(path: fileName).path
    }

    private static func posixError() -> Error {
        POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }
}
