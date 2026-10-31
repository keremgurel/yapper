import AppKit
import Foundation
import Testing
@testable import YapperNative

actor ControlParityStore: ProjectPersisting {
    var saves: [EditorProject] = []
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws { saves.append(project) }
}

/// Two editors on the same project: one driven by a control, one by Chirpy.
/// Every routed control is checked the same way: the control's call and a
/// Chirpy plan with the same values save the same project, and the control's
/// receipt names the action.
@MainActor
struct ControlParityHarness {
    let root: URL
    let video: ProjectMedia
    let project: EditorProject

    static func make() async throws -> ControlParityHarness {
        let root = FileManager.default.temporaryDirectory.appending(path: "control-parity-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appending(path: "take.mov")
        try await SyntheticVideo.write(color: NSColor.darkGray.cgColor, size: CGSize(width: 160, height: 90), seconds: 6, to: url)
        let video = try await MediaProbe.inspect(url: url)
        let words = [
            TranscriptWord(mediaID: video.id, text: "hello", start: 0.2, end: 0.6),
            TranscriptWord(mediaID: video.id, text: "there", start: 0.7, end: 1.1),
            TranscriptWord(mediaID: video.id, text: "friends", start: 1.2, end: 1.6),
        ]
        let project = EditorProject(
            name: "Parity",
            media: [video],
            clips: [TimelineClip(mediaID: video.id, sourceStart: 0, sourceEnd: 2),
                    TimelineClip(mediaID: video.id, sourceStart: 3, sourceEnd: 5)],
            transcript: words,
            captionsEnabled: true,
            captions: [
                ProjectCaption(mediaID: video.id, text: "hello there", sourceStart: 0.2, sourceEnd: 1.1, wordIDs: [words[0].id, words[1].id]),
                ProjectCaption(mediaID: video.id, text: "friends", sourceStart: 1.2, sourceEnd: 1.6, wordIDs: [words[2].id]),
            ],
            overlays: [ProjectOverlay(mediaID: video.id, timelineStart: 0.5, duration: 1.5)],
            textLayers: [ProjectTextLayer(text: "Hook", timelineStart: 0.5, duration: 1.5)]
        )
        return ControlParityHarness(root: root, video: video, project: project)
    }

    /// A built editor showing `project`, so actions that rebuild the
    /// composition and Undo can run.
    func session(_ project: EditorProject? = nil) async throws -> (EditorSession, ControlParityStore) {
        let store = ControlParityStore()
        let session = EditorSession(store: store)
        await Task.yield()
        session.updateProject { $0 = project ?? self.project }
        try await session.rebuildComposition(preserveTime: false)
        return (session, store)
    }

    func cleanUp(_ sessions: EditorSession...) {
        for session in sessions { session.player.replaceCurrentItem(with: nil) }
        try? FileManager.default.removeItem(at: root)
    }
}

extension EditorSession {
    /// Runs one action the way a Chirpy plan does.
    @discardableResult
    func chirpy(_ input: some AppActionInput) async throws -> AppActionResult {
        guard case .object(let fields) = try ActionJSON.encoding(input) else { throw AppActionError("bad test input") }
        let call = ChirpyActionCall(action: type(of: input).actionID.rawValue, arguments: fields)
        return await appActions.executeBatch([call], projectID: project.id, revision: actionRevision, in: self)[0]
    }

    /// Waits for a control that schedules its action from a synchronous call.
    func settleActions(until count: Int) async {
        for _ in 0..<4000 where appActions.recentResults.count < count { await Task.yield() }
        // The receipt is recorded as the edit commits; let its caller finish.
        for _ in 0..<50 { await Task.yield() }
    }

    var lastReceipt: AppActionResult? { appActions.recentResults.last }
}

/// Saved projects compared without the save time.
func parity(_ project: EditorProject) -> EditorProject {
    var copy = project
    copy.updatedAt = Date(timeIntervalSince1970: 0)
    return copy
}
