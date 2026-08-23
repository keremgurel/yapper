import Testing
@testable import YapperNative

@MainActor
@Suite("Preview presentation state")
struct PreviewPresentationStateTests {
    @Test("Entering and exiting fullscreen is idempotent")
    func enterAndExitAreIdempotent() {
        let state = PreviewPresentationState()

        state.enterFullScreen()
        state.enterFullScreen()
        #expect(state.isFullScreen)

        state.exitFullScreen()
        state.exitFullScreen()
        #expect(!state.isFullScreen)
    }

    @Test("The transport toggle changes presentation mode")
    func toggleChangesPresentationMode() {
        let state = PreviewPresentationState()

        state.toggleFullScreen()
        #expect(state.isFullScreen)

        state.toggleFullScreen()
        #expect(!state.isFullScreen)
    }
}
