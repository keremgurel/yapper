import Foundation

/// How carefully the speaker is cut out of the picture.
///
/// Segmentation is the most expensive thing the compositor does, and the two
/// places it runs want opposite things from it. The preview has to stay
/// scrubbable and is being watched at a fraction of the frame's real size, so a
/// rough edge there costs nothing anyone can see. The export is watched at full
/// size, once, and can afford to take its time.
///
/// Carried on the instruction rather than on the compositor because
/// AVFoundation instantiates the compositor itself, from a class name: the
/// instructions are the only thing the builder gets to hand it.
enum MatteQuality: Sendable {
    /// For the player. Rough around hair, and fast enough to scrub against.
    case fast
    /// For the file that gets posted.
    case accurate
}
