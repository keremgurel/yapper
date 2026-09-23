import SwiftUI

/// The recording screen: the frame and its controls on the left, the
/// script, teleprompter and devices on the right. In focus the right side
/// goes away and the frame takes the whole page.
struct RecorderCaptureLayout: View {
    let workspace: RecorderWorkspace
    @ObservedObject var capture: RecorderCaptureSession
    @ObservedObject var movie: RecorderMovieOutput
    @ObservedObject var countdown: RecorderCountdown
    @ObservedObject var script: RecorderScriptStore
    @ObservedObject var prompter: TeleprompterSettingsStore
    @Binding var showGuides: Bool
    let focused: Bool
    let onRecord: () -> Void

    var body: some View {
        if focused {
            stageColumn(height: nil)
                .padding(24)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.editorBackground)
        } else {
            HStack(alignment: .top, spacing: 28) {
                stageColumn(height: 620)
                    .frame(maxWidth: .infinity, alignment: .top)
                VStack(alignment: .leading, spacing: 16) {
                    RecorderPartialAccessNote(permissions: workspace.permissions)
                    RecorderScriptPanel(script: script)
                    RecorderPrompterPanel(store: prompter)
                    RecorderDevicesPanel(
                        capture: capture, devices: workspace.devices,
                        showGuides: $showGuides, locked: locked
                    )
                }
                .frame(width: 340)
                .disabled(locked)
            }
        }
    }

    private var locked: Bool { movie.isRecording || countdown.active || movie.phase == .finishing }

    private func stageColumn(height: CGFloat?) -> some View {
        VStack(spacing: 14) {
            RecorderStageView(
                capture: capture, movie: movie, flow: workspace.flow,
                prompt: script.promptText, settings: prompter.settings, showGuides: showGuides
            )
            .frame(height: height)
            .frame(maxHeight: height == nil ? .infinity : nil)
            if capture.micOn {
                RecorderAudioMeter(movie: movie).frame(width: 200)
            }
            RecorderControlBar(
                capture: capture, movie: movie, countdown: countdown,
                onRecord: onRecord, onFinish: workspace.flow.finish
            )
            if focused {
                Text("Press F or Escape to leave focus.").font(.system(size: 11)).foregroundStyle(.secondary)
            }
        }
    }
}
