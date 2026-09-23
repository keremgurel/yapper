import SwiftUI

/// Which camera and microphone feed the take, plus the framing guides.
struct RecorderDevicesPanel: View {
    @ObservedObject var capture: RecorderCaptureSession
    @ObservedObject var devices: RecorderDeviceCatalog
    @Binding var showGuides: Bool
    let locked: Bool

    var body: some View {
        NativeSection(title: "Camera and mic", card: true) {
            VStack(alignment: .leading, spacing: 12) {
                NativeField(label: "Camera") {
                    picker(devices.cameras, selection: capture.cameraID, empty: "No camera found") { capture.selectCamera($0) }
                }
                NativeField(label: "Microphone") {
                    picker(devices.microphones, selection: capture.micID, empty: "No microphone found") { capture.selectMic($0) }
                }
                Toggle(isOn: $showGuides) {
                    Text("Framing guides").font(.system(size: 13))
                }
                .toggleStyle(.switch)
                .controlSize(.small)
                .clickableCursor()
                Text("Space records and pauses, Return finishes, G shows guides, F focuses the frame.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .disabled(locked)
    }

    @ViewBuilder
    private func picker(
        _ list: [RecorderDevice], selection: String?, empty: String, choose: @escaping @Sendable @MainActor (String) -> Void
    ) -> some View {
        if list.isEmpty {
            Text(empty).font(.system(size: 13)).foregroundStyle(.secondary)
        } else {
            let fallback = list[0].id
            Picker("", selection: Binding(get: { selection ?? fallback }, set: { choose($0) })) {
                ForEach(list) { device in Text(device.name).tag(device.id) }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .clickableCursor()
        }
    }
}
