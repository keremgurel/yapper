@preconcurrency import AVFoundation
import AppKit
import Foundation

/// A still of the creator's own video with a template applied, for the cards
/// Chirpy offers. Drawn by the same composition the player and the export use,
/// on a copy of the project, so the card shows what tapping it will do.
enum StyleThumbnailRenderer {
    static func still(
        of plan: StyleTemplatePlan,
        offer: StyleOffer,
        project: EditorProject,
        playhead: Double
    ) async -> CGImage? {
        var copy = project
        guard let ranges = try? StyleRange.resolve(at: offer.at, until: offer.until, project: copy, playhead: playhead) else {
            return nil
        }
        _ = copy.applyStyleTemplate(plan, over: ranges)
        // The cards are small; a short render keeps three of them quick.
        guard let built = try? await CompositionBuilder.build(project: copy, maximumRenderDimension: 360) else { return nil }
        let generator = AVAssetImageGenerator(asset: built.asset)
        generator.videoComposition = built.playbackVideoComposition
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let moment = offer.start + min(1, max(0, (offer.end - offer.start) / 2))
        return try? await generator.image(at: CMTime(seconds: moment, preferredTimescale: 600)).image
    }
}
