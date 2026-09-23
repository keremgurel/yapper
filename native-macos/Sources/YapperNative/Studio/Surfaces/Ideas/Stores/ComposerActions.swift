import Foundation

/// What the composer's buttons and shortcuts do: bank the draft (taking a
/// running take along), and start or stop dictation.
@MainActor
final class ComposerActions: ObservableObject {
    static let shared = ComposerActions()

    @Published private(set) var saving = false
    @Published private(set) var captureError: String?

    private let draft = CaptureDraft.shared
    private let dictation = DictationController.shared

    var canSubmit: Bool { (!draft.isEmpty || dictation.recording) && !saving && !dictation.transcribing }

    func submit() async {
        guard !saving, !dictation.transcribing else { return }
        saving = true
        captureError = nil
        defer { saving = false }
        var words = draft.text
        if dictation.recording {
            // Sending mid-take means "include what I just said". A failed or
            // silent take leaves the draft exactly as it was.
            guard let heard = await dictation.stop() else { return }
            words = draft.insertDictation(heard)
        }
        let capture = words.ideasTrimmed
        guard !capture.isEmpty else { return }
        do {
            try await IdeaCapture.shared.capture(capture)
            draft.clear()
        } catch {
            captureError = "Your idea couldn't be saved. Your draft is still here; try again."
        }
    }

    func toggleVoice() async {
        guard !saving else { return }
        switch dictation.phase {
        case .idle:
            if dictation.permissionBlocked && dictation.microphoneDenied { dictation.openMicrophoneSettings() } else { await dictation.start() }
        case .recording:
            await finishTake()
        case .transcribing:
            break
        }
    }

    func finishTake() async {
        guard let heard = await dictation.stop() else { return }
        draft.insertDictation(heard)
    }
}
