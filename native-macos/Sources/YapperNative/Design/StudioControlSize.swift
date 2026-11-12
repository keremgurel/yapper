import SwiftUI

/// Control metrics. The web's `h-11` default is a touch target; on a Mac the
/// same design reads at native control heights, so the proportions carry over
/// and the sizes do not.
enum StudioControlSize {
    case regular
    case small
    case mini

    var height: CGFloat {
        switch self {
        case .regular: 36
        case .small: 30
        case .mini: 24
        }
    }

    var horizontalPadding: CGFloat {
        switch self {
        case .regular: 14
        case .small: 10
        case .mini: 8
        }
    }

    var cornerRadius: CGFloat {
        switch self {
        case .regular: 9
        case .small: 7
        case .mini: 6
        }
    }

    var font: Font {
        switch self {
        case .regular: .system(size: 13, weight: .medium)
        case .small: .system(size: 11.5, weight: .medium)
        case .mini: .system(size: 11, weight: .medium)
        }
    }
}
