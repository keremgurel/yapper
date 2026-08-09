@preconcurrency import AppKit
import SwiftUI

/// Whether the Command key is down right now.
///
/// The timeline's scroll monitor already claims Command-scroll for zooming and
/// consumes the event, but "consumed" is a promise made one event at a time,
/// and anything that slips past reaches the track list as a scroll. Holding
/// Command means zoom and nothing else, so the scroller is switched off for as
/// long as it is held rather than being asked politely each time.
@MainActor
final class CommandKeyMonitor: ObservableObject {
    @Published private(set) var isHeld = false

    /// The monitor token, in something that can be released from a `deinit`
    /// that is not on the main actor. The token is opaque and only ever handed
    /// straight back to `removeMonitor`, which is safe from any thread.
    private final class Token: @unchecked Sendable {
        let value: Any?

        init(_ value: Any?) { self.value = value }

        deinit {
            if let value { NSEvent.removeMonitor(value) }
        }
    }

    private var token: Token?

    init() {
        token = Token(
            NSEvent.addLocalMonitorForEvents(matching: [.flagsChanged]) { [weak self] event in
                let held = event.modifierFlags
                    .intersection(.deviceIndependentFlagsMask)
                    .contains(.command)
                MainActor.assumeIsolated {
                    guard let self, self.isHeld != held else { return }
                    self.isHeld = held
                }
                return event
            }
        )
    }
}
