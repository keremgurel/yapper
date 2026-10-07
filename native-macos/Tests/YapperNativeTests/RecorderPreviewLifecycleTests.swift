import AppKit
import Testing
@testable import YapperNative

@MainActor
struct RecorderPreviewLifecycleTests {
    @Test("Recreating a preview host retains the capture session's preview connection")
    func previewSurvivesHostReplacement() {
        let capture = RecorderCaptureSession()
        weak var oldHost: RecorderPreviewView.PreviewHostView?
        autoreleasepool {
            let host = RecorderPreviewView.PreviewHostView(previewLayer: capture.previewLayer)
            oldHost = host
            #expect(host.previewLayer.session === capture.session)
        }
        #expect(oldHost == nil)
        #expect(capture.previewLayer.session === capture.session)
        let replacement = RecorderPreviewView.PreviewHostView(previewLayer: capture.previewLayer)
        #expect(replacement.previewLayer === capture.previewLayer)
        #expect(replacement.previewLayer.session === capture.session)
    }
}
