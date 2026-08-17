import AppKit
import Foundation
import Testing
@testable import YapperNative

/// One press, one command.
///
/// Measured in the running app: a single Backspace arrived at the local monitor
/// twice, same timestamp, same monitor, same coordinator. The first pass
/// deleted the selected clip and the second, with the selection now empty,
/// took whatever the timeline had rippled under the playhead. Undo then put
/// back the wrong one, because the two removals were two separate edits.
@Suite
struct KeyPressClaimTests {
    private func keyDown(timestamp: TimeInterval, keyCode: UInt16) -> NSEvent {
        NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: [],
            timestamp: timestamp,
            windowNumber: 0,
            context: nil,
            characters: " ",
            charactersIgnoringModifiers: " ",
            isARepeat: false,
            keyCode: keyCode
        )!
    }

    @MainActor
    @Test("The same press is only acted on once")
    func claimsOnce() {
        let press = keyDown(timestamp: 1_000.5, keyCode: 51)
        #expect(TimelineKeyCommandView.Coordinator.claim(press))
        #expect(!TimelineKeyCommandView.Coordinator.claim(press))
        #expect(!TimelineKeyCommandView.Coordinator.claim(keyDown(timestamp: 1_000.5, keyCode: 51)))
    }

    @MainActor
    @Test("Pressing the same key again is a new press")
    func laterPressIsItsOwn() {
        #expect(TimelineKeyCommandView.Coordinator.claim(keyDown(timestamp: 2_000.0, keyCode: 49)))
        #expect(TimelineKeyCommandView.Coordinator.claim(keyDown(timestamp: 2_000.4, keyCode: 49)))
    }

    @MainActor
    @Test("Two keys in the same moment are both their own press")
    func differentKeysDoNotCollide() {
        #expect(TimelineKeyCommandView.Coordinator.claim(keyDown(timestamp: 3_000.0, keyCode: 49)))
        #expect(TimelineKeyCommandView.Coordinator.claim(keyDown(timestamp: 3_000.0, keyCode: 51)))
    }
}
