import AppKit
import UniformTypeIdentifiers

/// Files handed to Yapper from outside the app: Finder's Open With, a drop on
/// the Dock icon, `open -a`.
///
/// They used to fall through to the sign-in handoff and vanish. A video or an
/// image now goes into the open project the way Import media puts it there,
/// and a sound goes onto the timeline at the playhead the way Import audio
/// does. With no project open, a new one is made from the first video, which is
/// what dropping a video on the Projects screen already does.
@MainActor
final class OpenedFileImporter {
    static let shared = OpenedFileImporter()

    /// What an opened file is to the editor.
    enum Kind: Equatable {
        case media
        case audio
        case unsupported

        nonisolated init(url: URL) {
            guard url.isFileURL else { self = .unsupported; return }
            if !EditorSession.importableURLs([url]).isEmpty {
                self = .media
            } else if Self.isAudio(url) {
                self = .audio
            } else {
                self = .unsupported
            }
        }

        nonisolated private static func isAudio(_ url: URL) -> Bool {
            if let type = try? url.resourceValues(forKeys: [.contentTypeKey]).contentType {
                return type.conforms(to: .audio)
            }
            return ["mp3", "m4a", "wav", "aif", "aiff", "aac", "caf"].contains(url.pathExtension.lowercased())
        }
    }

    /// Finder hands a multi-file Open With over one URL at a time. Waiting a
    /// beat lets the rest arrive, so they import as one edit and one undo.
    static let gatherDelay: Duration = .milliseconds(250)

    private var pending: [URL] = []
    private var drain: Task<Void, Never>?

    func receive(_ url: URL, into session: EditorSession) {
        pending.append(url)
        guard drain == nil else { return }
        drain = Task { [weak self] in
            try? await Task.sleep(for: Self.gatherDelay)
            while let self, !self.pending.isEmpty {
                let batch = self.pending
                self.pending.removeAll()
                await self.importBatch(batch, into: session)
            }
            self?.drain = nil
        }
    }

    /// Resolves once every file received so far has been handled.
    func settle() async {
        await drain?.value
    }

    private func importBatch(_ urls: [URL], into session: EditorSession) async {
        await session.awaitRestoration()
        await waitForIdle(session)
        let media = urls.filter { Kind(url: $0) == .media }
        let audio = urls.filter { Kind(url: $0) == .audio }
        if media.isEmpty, audio.isEmpty {
            session.setStatus("That is not a video, an image or a sound this editor can open")
            return
        }
        if session.projectNavigation.currentPackage == nil {
            guard !media.isEmpty else {
                session.setStatus("Open a project with a video before adding sound")
                return
            }
            await session.createProject(fromVideos: media)
        } else if !media.isEmpty {
            await session.importMedia(media)
        }
        if !audio.isEmpty {
            if session.duration > 0 {
                await session.importAudio(audio)
            } else {
                session.setStatus("Add a video before adding sound")
            }
        }
        showEditor(session)
    }

    /// An import, an export or a transcription in flight would turn the
    /// import away. The files wait for it instead of being dropped.
    private func waitForIdle(_ session: EditorSession) async {
        guard session.activeOperation != nil else { return }
        session.setStatus("Opening the file once the current job finishes…")
        while session.activeOperation != nil, !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(200))
        }
    }

    private func showEditor(_ session: EditorSession) {
        session.hideProjectsHome()
        UserDefaults.standard.set(StudioDestination.editor.rawValue, forKey: "studioDestination")
        NSApp?.activate(ignoringOtherApps: true)
    }
}
