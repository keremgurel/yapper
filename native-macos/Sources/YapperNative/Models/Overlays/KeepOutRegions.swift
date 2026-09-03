import CoreGraphics
import Foundation

/// The parts of the frame that are not the speaker but still should not have
/// a card dropped on them: the caption band, and the strips a platform's own
/// chrome covers.
///
/// Pure arithmetic on fractions, like `SpeakerRegions`. The weights are the
/// point. A face is 1.0 and covering it is the worst thing a placement can
/// do. A neighbouring overlay is 0.5. Captions sit between, at 0.6: a card on
/// the captions hides words the viewer is reading, which is worse than two
/// cards touching, but a card that shrinks to a stamp to dodge the captions is
/// still worse than one that grazes them. The safe zones sit well below all
/// of that because they are a guess about somebody else's interface: a card
/// that clears the face and the captions is allowed to sit under where a
/// share button might be, but nudged away from it when the shot has room.
enum KeepOutRegions {
    /// Covering the caption band.
    static let captionWeight = 0.6
    /// Covering text layers that are on screen at the same time.
    static let textWeight = 0.5

    /// How tall one line of caption text is, as a multiple of its font size.
    /// The same factor `TextAppearanceLayer` lays lines out with.
    static let lineHeight = 1.2

    /// Where the captions are drawn, as a region the solver should stay off.
    ///
    /// The band is the card at its default placement, tall enough for the
    /// lines a card usually wraps to. `fontScale` is a fraction of the frame
    /// height, so the height comes straight out of it: lines of text plus the
    /// card's padding above and below.
    ///
    /// - Parameter wordsPerCardHint: how many words a card carries. Up to four
    ///   fits on two lines at the default size; more than that wraps to three.
    static func captionBand(style: TextStyle, wordsPerCardHint: Int = 4) -> SpeakerRegion {
        let lines = wordsPerCardHint > 4 ? 3.0 : 2.0
        let fontScale = style.fontScale
        let padding = style.appearance.verticalPadding * fontScale * 2
        let height = fontScale * lineHeight * lines + padding
        let width = min(1, max(TextStyle.minimumWidth, style.width))
        let rect = SpeakerRegions.clamped(
            CGRect(
                x: style.x - width / 2,
                y: style.y - height / 2,
                width: width,
                height: height
            )
        )
        return SpeakerRegion(rect: rect, weight: captionWeight)
    }

    /// The strips a platform's own interface covers on a frame of this shape.
    ///
    /// Tall frames are Reels, Shorts and TikTok, which all put a column of
    /// buttons down the right edge and a caption plus handle along the bottom.
    /// Wide frames are YouTube, whose controls only show on hover, so only the
    /// scrubber's strip at the bottom is worth avoiding. Square and feed
    /// frames sit above a caption in a feed, so the bottom is the risk.
    static func safeZones(frameAspect: Double) -> [SpeakerRegion] {
        if frameAspect < 0.75 {
            return [
                SpeakerRegion(rect: CGRect(x: 0.86, y: 0, width: 0.14, height: 1), weight: 0.3),
                SpeakerRegion(rect: CGRect(x: 0, y: 0.86, width: 1, height: 0.14), weight: 0.3),
            ]
        }
        if frameAspect > 1.3 {
            return [SpeakerRegion(rect: CGRect(x: 0, y: 0.92, width: 1, height: 0.08), weight: 0.15)]
        }
        return [SpeakerRegion(rect: CGRect(x: 0, y: 0.9, width: 1, height: 0.1), weight: 0.2)]
    }

    /// Text layers up during a span, as places a card should not sit.
    static func textLayers(
        _ layers: [ProjectTextLayer],
        from start: Double,
        to end: Double,
        frameAspect: Double
    ) -> [SpeakerRegion] {
        layers
            .filter { $0.timelineStart < end && $0.timelineStart + $0.duration > start }
            .map { layer in
                // A text layer stores its centre and width; its height is set
                // by the words and the font, so the same line arithmetic as the
                // caption band stands in for it.
                let height = layer.fontScale * lineHeight * 2
                    + layer.appearance.verticalPadding * layer.fontScale * 2
                return SpeakerRegion(
                    rect: SpeakerRegions.clamped(
                        CGRect(
                            x: layer.x - layer.width / 2,
                            y: layer.y - height / 2,
                            width: layer.width,
                            height: height
                        )
                    ),
                    weight: textWeight
                )
            }
    }
}
