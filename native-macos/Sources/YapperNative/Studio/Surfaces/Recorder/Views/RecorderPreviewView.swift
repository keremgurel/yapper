@preconcurrency import AVFoundation
import SwiftUI

/// The live camera, mirrored like a mirror and cropped to fill its frame.
/// The file itself is recorded unmirrored, the same as the web recorder.
struct RecorderPreviewView: NSViewRepresentable {
    let previewLayer: AVCaptureVideoPreviewLayer
    /// Changes whenever the inputs do, so the new connection gets mirrored.
    var inputsKey: String = ""

    func makeNSView(context: Context) -> PreviewHostView {
        PreviewHostView(previewLayer: previewLayer)
    }

    func updateNSView(_ view: PreviewHostView, context: Context) {
        view.applyMirroring()
    }

    final class PreviewHostView: NSView {
        let previewLayer: AVCaptureVideoPreviewLayer

        init(previewLayer: AVCaptureVideoPreviewLayer) {
            self.previewLayer = previewLayer
            super.init(frame: .zero)
            wantsLayer = true
            layer = CALayer()
            layer?.backgroundColor = NSColor.black.cgColor
            previewLayer.videoGravity = .resizeAspectFill
            layer?.addSublayer(previewLayer)
        }

        required init?(coder: NSCoder) { nil }

        override func layout() {
            super.layout()
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            previewLayer.frame = bounds
            CATransaction.commit()
            applyMirroring()
        }

        func applyMirroring() {
            guard let connection = previewLayer.connection, connection.isVideoMirroringSupported,
                  !connection.isVideoMirrored else { return }
            connection.automaticallyAdjustsVideoMirroring = false
            connection.isVideoMirrored = true
        }
    }
}
