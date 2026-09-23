@preconcurrency import AVFoundation
import SwiftUI

/// The live camera, mirrored like a mirror and cropped to fill its frame.
/// The file itself is recorded unmirrored, the same as the web recorder.
struct RecorderPreviewView: NSViewRepresentable {
    let session: AVCaptureSession
    /// Changes whenever the inputs do, so the new connection gets mirrored.
    var inputsKey: String = ""

    func makeNSView(context: Context) -> PreviewHostView {
        let view = PreviewHostView()
        view.previewLayer.session = session
        return view
    }

    func updateNSView(_ view: PreviewHostView, context: Context) {
        if view.previewLayer.session !== session { view.previewLayer.session = session }
        view.applyMirroring()
    }

    final class PreviewHostView: NSView {
        let previewLayer = AVCaptureVideoPreviewLayer()

        override init(frame: NSRect) {
            super.init(frame: frame)
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
