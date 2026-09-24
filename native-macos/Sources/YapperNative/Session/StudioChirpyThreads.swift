import CryptoKit
import Foundation

/// One Chirpy conversation per Studio tab.
///
/// The editor keeps its history with each project. Every other tab has its
/// own thread, saved on this Mac per account, so asking on Brain continues the
/// Brain conversation and asking on Poster continues Poster's.
@MainActor
final class StudioChirpyThreads: ObservableObject {
    static let shared = StudioChirpyThreads()

    /// The thread of the tab in front, or nil in the editor.
    @Published private(set) var current: AssistantConversation?
    /// The route of the tab in front, sent with each ask so Chirpy knows it.
    private(set) var surface: String?
    private var threads: [String: AssistantConversation] = [:]

    func activate(_ destination: StudioDestination, userID: String?) {
        guard destination != .editor, destination != .signIn else {
            current = nil
            surface = nil
            return
        }
        let key = "\(userID ?? "signed-out"):\(destination.rawValue)"
        surface = destination.cloudPath
        if let thread = threads[key] {
            current = thread
            return
        }
        let thread = AssistantConversation()
        if let url = Self.archiveURL(userID: userID, destination: destination) {
            thread.attachThread(key: key, url: url)
        }
        threads[key] = thread
        current = thread
    }

    private static func archiveURL(userID: String?, destination: StudioDestination) -> URL? {
        guard let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        else { return nil }
        let folder = support
            .appending(path: "Yapper Studio", directoryHint: .isDirectory)
            .appending(path: "Chirpy", directoryHint: .isDirectory)
            .appending(path: userID ?? "signed-out", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appending(path: "\(destination.rawValue).json")
    }
}

extension UUID {
    /// A stable UUID for a name, so a tab's thread keeps its identity.
    static func named(_ name: String) -> UUID {
        let digest = Array(SHA256.hash(data: Data(name.utf8)))
        return UUID(uuid: (digest[0], digest[1], digest[2], digest[3], digest[4], digest[5], digest[6], digest[7],
                           digest[8], digest[9], digest[10], digest[11], digest[12], digest[13], digest[14], digest[15]))
    }
}
