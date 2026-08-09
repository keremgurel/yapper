import Foundation

/// The shape a crop is being held to while it is dragged.
///
/// A preset is a live constraint rather than a button that reshapes the
/// rectangle once and lets go: picking 1:1 and then dragging a corner should
/// still give a square, which is the whole reason to pick it.
enum CropAspect: String, CaseIterable, Identifiable, Sendable {
    case free
    /// The source's own shape, so a crop takes a smaller piece of the same
    /// picture rather than a differently shaped one.
    case original
    case square
    case portrait45
    case portrait916
    case landscape169

    var id: String { rawValue }

    var title: String {
        switch self {
        case .free: "Free"
        case .original: "Original"
        case .square: "1:1"
        case .portrait45: "4:5"
        case .portrait916: "9:16"
        case .landscape169: "16:9"
        }
    }

    /// Width over height of the finished rectangle, in real pixels, or nil when
    /// the shape is not being held to anything.
    ///
    /// - Parameter sourceAspect: needed for `original`, and for nothing else.
    func ratio(sourceAspect: Double) -> Double? {
        switch self {
        case .free: nil
        case .original: sourceAspect > 0 ? sourceAspect : nil
        case .square: 1
        case .portrait45: 4.0 / 5.0
        case .portrait916: 9.0 / 16.0
        case .landscape169: 16.0 / 9.0
        }
    }
}
