import AppKit
import SwiftUI

/// Record a take with the script scrolling over the camera, review it, then
/// save it to the library, download it, or open it in the Mac editor.
struct RecorderPage: View {
    private let workspace = RecorderWorkspace.shared
    @ObservedObject private var permissions = RecorderWorkspace.shared.permissions
    @ObservedObject private var flow = RecorderWorkspace.shared.flow
    @ObservedObject private var script = RecorderWorkspace.shared.script
    @ObservedObject private var prompter = RecorderWorkspace.shared.prompter
    @State private var showGuides = false
    @State private var focused = false

    var body: some View {
        content
            .recorderKeys(enabled: flow.take == nil && !permissions.blocked, handle: handleKey)
            .task {
                await script.takeHandoff()
                await permissions.request()
                startCaptureIfNeeded()
            }
            .onReceive(NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)) { _ in
                // A take under review keeps the idea it was recorded for.
                guard flow.take == nil, !workspace.capture.movie.isRecording else { return }
                Task { await script.takeHandoff() }
            }
            .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
                // The creator may be back from System Settings with access granted.
                permissions.refresh()
                startCaptureIfNeeded()
            }
            .onChange(of: flow.take) { _, take in
                workspace.saving.reset()
                if take != nil { focused = false; workspace.capture.stop() } else { startCaptureIfNeeded() }
            }
            .onDisappear {
                workspace.flow.interrupt()
                workspace.capture.stop()
            }
    }

    @ViewBuilder
    private var content: some View {
        if let take = flow.take {
            NativePage(maxWidth: 1080) {
                NativePageHeader(title: "Review your take", description: "Play it back, then keep it or record it again.")
                RecorderReviewView(
                    take: take, itemID: script.itemID, title: script.itemTitle,
                    saving: workspace.saving, onRetake: { flow.retake() }
                )
            }
        } else if permissions.blocked {
            NativePage(maxWidth: 1080) {
                NativePageHeader(title: "Recorder")
                RecorderPermissionView(permissions: permissions)
            }
        } else if focused {
            layout
        } else {
            NativePage(maxWidth: 1080) {
                NativePageHeader(
                    title: "Recorder",
                    description: "Record your take with a scrolling teleprompter, then save it to your library or download it."
                ) {
                    Button { focused = true } label: { Label("Focus", systemImage: "arrow.up.left.and.arrow.down.right") }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                        .help("Hide everything but the frame (F)")
                }
                layout
            }
        }
    }

    private var layout: some View {
        RecorderCaptureLayout(
            workspace: workspace, capture: workspace.capture, movie: workspace.capture.movie,
            countdown: flow.countdown, script: script, prompter: prompter,
            showGuides: $showGuides, focused: focused, onRecord: record
        )
    }

    private func record() {
        flow.pressRecord(
            canRecord: workspace.capture.canRecord,
            leadInSeconds: prompter.settings.leadInSeconds,
            hasPrompt: !script.promptText.isEmpty
        )
    }

    private func startCaptureIfNeeded() {
        guard flow.take == nil, !permissions.blocked,
              permissions.camera != .unknown || permissions.microphone != .unknown else { return }
        workspace.devices.reload()
        workspace.capture.start(
            access: RecorderAccess(camera: permissions.camera == .granted, microphone: permissions.microphone == .granted),
            cameras: workspace.devices.cameras,
            microphones: workspace.devices.microphones
        )
    }

    private func handleKey(_ key: RecorderKeyMonitor.Key) -> Bool {
        switch key {
        case .record: record()
        case .finish:
            guard workspace.capture.movie.isRecording else { return false }
            flow.finish()
        case .guides: showGuides.toggle()
        case .focus: focused.toggle()
        case .escape:
            guard focused else { return false }
            focused = false
        }
        return true
    }
}
