import Foundation

/// A one-shot request to reveal the transcript line and caption card nearest a
/// timeline seek.
///
/// This deliberately does not follow the playback clock. Scrubbing publishes
/// once, when the pointer is released; playback and the live scrub publish
/// nothing. The two text panels can therefore jump to the result without
/// acquiring a 30 fps dependency or fighting somebody who is reading elsewhere.
@MainActor
final class TimelineSeekRevealState: ObservableObject {
    struct Request: Equatable, Sendable {
        let sequence: UInt64
        let timelineTime: Double
    }

    @Published private(set) var request: Request?
    private var sequence: UInt64 = 0

    func reveal(at timelineTime: Double) {
        sequence &+= 1
        request = Request(sequence: sequence, timelineTime: timelineTime)
    }
}
