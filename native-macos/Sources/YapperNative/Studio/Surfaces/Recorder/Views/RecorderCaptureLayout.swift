import SwiftUI

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
        GeometryReader { geometry in
            HStack(alignment: .top, spacing: 24) {
                VStack(spacing: 12) {
                    RecorderStageView(capture: capture, movie: movie, flow: workspace.flow,
                        prompt: script.promptText, settings: prompter.settings, showGuides: showGuides)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .layoutPriority(-1)
                    if capture.micOn { RecorderAudioMeter(movie: movie).frame(width: 200) }
                    if !movie.isRecording {
                        HStack {
                            Text(capture.readiness).font(.system(size: 12)).fixedSize(horizontal: false, vertical: true)
                            if !capture.canRecord && !capture.configuring && (capture.cameraOn || capture.micOn) {
                                Button("Retry devices") { capture.retry() }
                                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                            }
                        }
                    }
                    if !script.promptText.isEmpty {
                        RecorderRehearsalControls(scroller: workspace.flow.scroller,
                            locked: countdown.active || movie.phase == .finishing)
                    }
                    RecorderControlBar(capture: capture, movie: movie, countdown: countdown,
                        onRecord: onRecord, onFinish: workspace.flow.finish)
                    if focused {
                        RecorderPrompterPanel(store: prompter, compact: true)
                        Text("Press F or Escape to leave focus.").font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                if !focused {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            RecorderPartialAccessNote(permissions: workspace.permissions)
                            NativeField(label: "Camera frame") {
                                RecorderSegmented(options: RecorderFraming.allCases.map { .init(value: $0, label: $0.label) }, selection: $prompter.settings.framing)
                                    .disabled(locked)
                            }
                            Text("Auto uses the camera frame. Other ratios crop the center of the preview and saved video.")
                                .font(.system(size: 12)).foregroundStyle(.secondary)
                            RecorderScriptPanel(script: script).disabled(locked)
                            RecorderPrompterPanel(store: prompter)
                            RecorderDevicesPanel(capture: capture, devices: workspace.devices,
                                showGuides: $showGuides, locked: locked)
                        }
                    }
                    .frame(width: min(320, geometry.size.width * 0.38))
                }
            }
        }
    }
    private var locked: Bool { movie.isRecording || countdown.active || movie.phase == .finishing }
}

private struct RecorderRehearsalControls: View {
    @ObservedObject var scroller: TeleprompterScroller
    let locked: Bool
    var body: some View {
        HStack(spacing: 12) {
            Button(scroller.running ? "Pause prompt" : "Play prompt", systemImage: scroller.running ? "pause" : "play") {
                if scroller.running { scroller.pause() } else { scroller.play() }
            }
            Button("Restart prompt", systemImage: "backward.end") { scroller.reset() }
        }
        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        .disabled(locked)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Teleprompter rehearsal")
    }
}
