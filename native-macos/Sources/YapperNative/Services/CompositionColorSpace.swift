@preconcurrency import AVFoundation
import Foundation

/// What colour space a composition renders into.
///
/// Left unset, AVFoundation works one out from whatever tracks the composition
/// happens to hold, and a cutaway changes what it holds. Overlay footage is
/// regularly untagged: ProRes 4444 out of a screen recorder or a motion tool
/// carries no primaries, no transfer function and no matrix at all. Dropping
/// one of those onto a BT.709 take moved every pixel of the take underneath it,
/// including the ones nowhere near the cutaway, which is why the picture
/// appeared to change its lighting the moment an overlay arrived and change
/// back when it left.
///
/// So the output space is stated rather than inferred. It is taken from the
/// take the timeline opens on, which is the footage the creator is grading by
/// eye, and anything joining that composition is converted into it instead of
/// dragging it somewhere else.
enum CompositionColorSpace {
    struct Tags: Equatable {
        let primaries: String
        let transfer: String
        let matrix: String

        /// What a camera hands over for ordinary HD, and the only sensible
        /// answer for footage that says nothing about itself.
        static let rec709 = Tags(
            primaries: AVVideoColorPrimaries_ITU_R_709_2,
            transfer: AVVideoTransferFunction_ITU_R_709_2,
            matrix: AVVideoYCbCrMatrix_ITU_R_709_2
        )
    }

    /// Combinations AVFoundation will render into. A composition given anything
    /// else refuses to render at all, so an unrecognised source falls back
    /// rather than taking the preview down with it.
    private static let supported: Set<Tags> = [
        .rec709,
        Tags(
            primaries: AVVideoColorPrimaries_SMPTE_C,
            transfer: AVVideoTransferFunction_ITU_R_709_2,
            matrix: AVVideoYCbCrMatrix_ITU_R_601_4
        ),
        Tags(
            primaries: AVVideoColorPrimaries_ITU_R_2020,
            transfer: AVVideoTransferFunction_ITU_R_2100_HLG,
            matrix: AVVideoYCbCrMatrix_ITU_R_2020
        ),
        Tags(
            primaries: AVVideoColorPrimaries_ITU_R_2020,
            transfer: AVVideoTransferFunction_SMPTE_ST_2084_PQ,
            matrix: AVVideoYCbCrMatrix_ITU_R_2020
        ),
    ]

    /// The tags a track carries, when it carries a full set this can render.
    static func tags(of track: AVAssetTrack?) async -> Tags {
        guard
            let track,
            let description = try? await track.load(.formatDescriptions).first,
            let primaries = tag(kCMFormatDescriptionExtension_ColorPrimaries, of: description),
            let transfer = tag(kCMFormatDescriptionExtension_TransferFunction, of: description),
            let matrix = tag(kCMFormatDescriptionExtension_YCbCrMatrix, of: description)
        else { return .rec709 }
        let tags = Tags(primaries: primaries, transfer: transfer, matrix: matrix)
        return supported.contains(tags) ? tags : .rec709
    }

    static func apply(_ tags: Tags, to composition: AVMutableVideoComposition) {
        composition.colorPrimaries = tags.primaries
        composition.colorTransferFunction = tags.transfer
        composition.colorYCbCrMatrix = tags.matrix
    }

    private static func tag(
        _ key: CFString,
        of description: CMFormatDescription
    ) -> String? {
        CMFormatDescriptionGetExtension(description, extensionKey: key) as? String
    }
}

extension CompositionColorSpace.Tags: Hashable {}
