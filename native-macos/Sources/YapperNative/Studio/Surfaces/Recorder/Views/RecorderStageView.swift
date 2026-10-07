import SwiftUI

/// The selected camera frame: live camera, framing guides, the prompt, and the take's
/// state over the top. Nothing in here is a control; the controls sit below.
struct RecorderStageView: View {
    @ObservedObject var capture: RecorderCaptureSession
    @ObservedObject var movie: RecorderMovieOutput
    @ObservedObject var flow: RecorderTakeFlow
    let prompt: String
    @Binding var settings: TeleprompterSettings
    let showGuides: Bool

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
        ZStack {
            Color.black
            RecorderPreviewView(
                previewLayer: capture.previewLayer,
                inputsKey: "\(capture.cameraID ?? "")|\(capture.running)"
            )
            .opacity(capture.cameraReady ? 1 : 0)
            if !capture.cameraReady && prompt.isEmpty {
                cameraOff
            }
            if showGuides { RecorderGuidesOverlay() }
            if !prompt.isEmpty {
                TeleprompterOverlayView(text: prompt, settings: $settings, scroller: flow.scroller)
            }
            RecorderCountdownNumeral(countdown: flow.countdown)
            overlays
            if flow.finishing { finishing }
        }
        .aspectRatio(settings.framing.ratio(source: capture.sourceRatio), contentMode: .fit)
        .clipShape(shape)
        .overlay(shape.strokeBorder(Color.studioLine, lineWidth: 1))
    }

    private var overlays: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                if movie.isRecording { RecorderTimeBadge(movie: movie) }
                Spacer(minLength: 0)
            }
            if let problem = capture.problem ?? movie.failure {
                RecorderStageNotice(message: problem)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
    }

    private var cameraOff: some View {
        VStack(spacing: 8) {
            Image(systemName: "video.slash").font(.system(size: 22))
            Text(!capture.cameraOn && !capture.micOn ? "Camera and microphone are off." : capture.configuring ? "Preparing devices…" : capture.micReady ? "Audio-only recording is ready." : "Camera preview is unavailable.")
                .font(.system(size: 12, weight: .medium))
        }
        .foregroundStyle(Color.white.opacity(0.65))
    }

    private var finishing: some View {
        ZStack {
            Color.black.opacity(0.55)
            HStack(spacing: 8) {
                ProgressView().controlSize(.small).tint(.white)
                Text("Finishing the take…").font(.system(size: 13, weight: .medium)).foregroundStyle(.white)
            }
        }
    }
}
