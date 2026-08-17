@preconcurrency import AVFoundation
import Foundation
import Testing
@testable import YapperNative

/// A composition that states its output colour space renders the same picture
/// whatever else is in it. Left to infer one, AVFoundation reads it off the
/// tracks, and overlay footage is regularly untagged: ProRes 4444 out of a
/// screen recorder carries no primaries, no transfer function and no matrix.
@Suite
struct CompositionColorSpaceTests {
    @Test("An untagged track leaves the output where the take put it")
    func fallsBackToRec709() async {
        #expect(await CompositionColorSpace.tags(of: nil) == .rec709)
    }

    @Test("The composition carries the tags it was given")
    func appliesTags() {
        let composition = AVMutableVideoComposition()
        CompositionColorSpace.apply(.rec709, to: composition)
        #expect(composition.colorPrimaries == AVVideoColorPrimaries_ITU_R_709_2)
        #expect(composition.colorTransferFunction == AVVideoTransferFunction_ITU_R_709_2)
        #expect(composition.colorYCbCrMatrix == AVVideoYCbCrMatrix_ITU_R_709_2)
    }
}
