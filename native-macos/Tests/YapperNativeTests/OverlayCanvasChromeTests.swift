import Foundation
import Testing
@testable import YapperNative

struct OverlayCanvasChromeTests {
    private func overlay(behindSpeaker: Bool) -> ProjectOverlay {
        ProjectOverlay(
            mediaID: UUID(),
            timelineStart: 0,
            duration: 5,
            behindSpeaker: behindSpeaker ? true : nil
        )
    }

    @Test("A selected behind-speaker overlay has no foreground perimeter")
    func selectedBehindSpeakerOverlayHasNoPerimeter() {
        let visible = OverlayCanvasChrome.showsCutawayHint(
            isBehindSpeaker: overlay(behindSpeaker: true).isBehindSpeaker,
            isImage: false,
            isSelected: true
        )

        #expect(!visible)
    }

    @Test("An unselected behind-speaker cutaway has no foreground hint")
    func unselectedBehindSpeakerCutawayHasNoPerimeter() {
        let visible = OverlayCanvasChrome.showsCutawayHint(
            isBehindSpeaker: overlay(behindSpeaker: true).isBehindSpeaker,
            isImage: false,
            isSelected: false
        )

        #expect(!visible)
    }

    @Test("Only an idle front cutaway gets a placement hint")
    func onlyIdleFrontCutawaysGetAPerimeter() {
        let front = overlay(behindSpeaker: false)

        #expect(!OverlayCanvasChrome.showsCutawayHint(
            isBehindSpeaker: front.isBehindSpeaker,
            isImage: true,
            isSelected: true
        ))
        #expect(OverlayCanvasChrome.showsCutawayHint(
            isBehindSpeaker: front.isBehindSpeaker,
            isImage: false,
            isSelected: false
        ))
        #expect(!OverlayCanvasChrome.showsCutawayHint(
            isBehindSpeaker: front.isBehindSpeaker,
            isImage: true,
            isSelected: false
        ))
    }
}
