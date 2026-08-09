import SwiftUI

/// The stationary frames that canvas drags are measured against.
///
/// A `DragGesture` left in its default `.local` space reports how far the
/// pointer has moved *relative to the view the gesture is attached to*. Every
/// draggable thing on the canvas moves itself as it is dragged, so that view is
/// not standing still, and the measurement fights the movement: the view chases
/// half of each step and then holds while the next event cancels the other half.
///
/// Measured with a synthetic drag of eight 12pt steps:
///
///     mouse moved (cumulative):  12  24  36  48  60  72  84  96
///     .local translation seen:   12  12  24  24  36  36  48  48
///     .named(stage) seen:        12  24  36  48  60  72  84  96
///
/// That is the stutter — the item travels at half the speed of the pointer, in
/// hops, holding still every other event. Naming a space on an ancestor that
/// does not move gives the gesture a fixed thing to measure against, which is
/// why every drag in the timeline has always been smooth: it has done this from
/// the start.
enum CanvasCoordinateSpace {
    /// The player stage, declared in `PlayerPanel`. Overlays, text layers and
    /// caption cards all live inside it.
    static let stage = "playerStage"

    /// The crop editor's picture, declared in `OverlayCropEditor`.
    static let crop = "overlayCrop"
}
