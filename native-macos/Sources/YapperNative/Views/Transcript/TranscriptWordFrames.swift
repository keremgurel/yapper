import CoreGraphics
import Foundation
import SwiftUI

/// Where the transcript's flow sits: one reader for the whole transcript, in
/// place of one behind every word.
///
/// Only the origin travels this way. The width is taken from the layout itself,
/// because the wrapping has to answer to the width of the pane in the pass that
/// is drawing it.
struct TranscriptFlowOriginKey: PreferenceKey {
    static let defaultValue: CGPoint = .zero

    static func reduce(value: inout CGPoint, nextValue: () -> CGPoint) {
        value = nextValue()
    }
}
