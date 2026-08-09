import Foundation

/// Where a new text layer starts and how long it runs.
///
/// A hook is the thing that opens the video, so it goes to the top of the
/// timeline however far in the playhead happens to be. Plain text is placed
/// where you are, because that is where you asked for it.
enum TextLayerPlacement {
    static let defaultDuration = 5.0

    static func span(
        asHook: Bool,
        currentTime: Double,
        projectDuration: Double
    ) -> (start: Double, duration: Double) {
        let end = max(0, projectDuration)
        let start = asHook ? 0 : min(max(0, currentTime), max(0, end - 0.1))
        // Never longer than what is left of the project, and never zero.
        let available = max(0.1, end - start)
        return (start, min(defaultDuration, available))
    }
}
