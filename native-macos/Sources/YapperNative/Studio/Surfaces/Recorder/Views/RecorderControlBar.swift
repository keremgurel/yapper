import SwiftUI

/// Under the frame: microphone, the record button, camera. While a take runs
/// the sides become nothing and Finish, so the record button stays centred.
struct RecorderControlBar: View {
    @ObservedObject var capture: RecorderCaptureSession
    @ObservedObject var movie: RecorderMovieOutput
    @ObservedObject var countdown: RecorderCountdown
    let onRecord: () -> Void
    let onFinish: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            leading.frame(width: 120, alignment: .trailing)
            Button(action: onRecord) {
                Label(recordTitle, systemImage: recordSymbol)
                    .frame(minWidth: 112)
            }
            .buttonStyle(EditorPrimaryButtonStyle())
            .disabled(!movie.isRecording && !countdown.active && !capture.canRecord)
            .help(recordHelp)
            trailing.frame(width: 120, alignment: .leading)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var leading: some View {
        if !movie.isRecording {
            Button { capture.toggleMic() } label: {
                Label(capture.micOn ? "Mic on" : "Mic off", systemImage: capture.micOn ? "mic" : "mic.slash")
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(countdown.active)
            .help(capture.micOn ? "Mute the microphone" : "Turn the microphone on")
        }
    }

    @ViewBuilder
    private var trailing: some View {
        if movie.isRecording {
            Button(action: onFinish) { Label("Finish", systemImage: "checkmark") }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .help("Finish the take (Return)")
        } else {
            Button { capture.toggleCamera() } label: {
                Label(capture.cameraOn ? "Camera on" : "Camera off", systemImage: capture.cameraOn ? "video" : "video.slash")
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(countdown.active)
            .help(capture.cameraOn ? "Turn the camera off" : "Turn the camera on")
        }
    }

    private var recordTitle: String {
        if countdown.active { return "Cancel" }
        switch movie.phase {
        case .recording: return "Pause"
        case .paused: return "Resume"
        case .finishing: return "Finishing"
        case .idle: return "Record"
        }
    }

    private var recordSymbol: String {
        if countdown.active { return "xmark" }
        switch movie.phase {
        case .recording: return "pause.fill"
        case .paused: return "record.circle"
        case .finishing: return "hourglass"
        case .idle: return "record.circle"
        }
    }

    private var recordHelp: String {
        if !movie.isRecording && !capture.canRecord { return "Turn on your camera or mic first" }
        return "\(recordTitle) (Space)"
    }
}
