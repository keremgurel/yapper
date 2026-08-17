import CoreGraphics
import Foundation

/// Finding blemishes by their shape rather than by their strength.
///
/// Scoring this pixel by pixel cannot work. At blemish scale, ordinary skin
/// varies as much as a spot does, so a threshold on how far a pixel sits from
/// its surroundings either catches the whole cheek or catches nothing.
///
/// What separates them is shape. A spot is small, roughly round and surrounded
/// by skin. A lip line is a long ridge, an eyelid is an extended edge, and a
/// shadow is bigger than a face has any business calling a spot. None of that
/// can be seen one pixel at a time, so the anomalies are grouped into objects
/// first and judged as objects.
enum BlemishBlobs {
    /// One anomaly, measured in the coordinates of the map it was found in.
    struct Blob: Equatable {
        var bounds: CGRect
        var area: Int
        /// The strongest reading anywhere inside it.
        ///
        /// A spot is a modest departure from the skin around it. Anything
        /// overwhelming is a nostril, the edge of a beard or the shadow under a
        /// chin, and levelling one of those to the surrounding skin tone paints
        /// a bright disc onto a face. That is not a subtle failure, so this is
        /// not a subtle guard.
        var peak: Int = 0

        /// Where a disc covering it would sit.
        var centre: CGPoint { CGPoint(x: bounds.midX, y: bounds.midY) }

        /// Half the longer side, which is the radius that covers the blob.
        var radius: Double { Double(max(bounds.width, bounds.height)) / 2 }

        /// How square the blob's own box is. A spot is close to 1, a lip line
        /// or the rim of an eyelid is nowhere near it.
        var squareness: Double {
            let long = Double(max(bounds.width, bounds.height))
            let short = Double(min(bounds.width, bounds.height))
            guard long > 0 else { return 0 }
            return short / long
        }

        /// How much of its own box the blob fills. A disc fills about three
        /// quarters; a diagonal streak fills a fraction of one.
        var fullness: Double {
            let box = Double(bounds.width * bounds.height)
            guard box > 0 else { return 0 }
            return Double(area) / box
        }
    }

    /// What a blob has to look like to be treated as a blemish. The sizes are
    /// fractions of the face's width; the strength is in the map's own units.
    struct Rules {
        /// Under this it is sensor noise or a single pore.
        var smallest = 0.010
        /// Over this it is a shadow, a highlight or a feature.
        var largest = 0.060
        /// Under this it is a line rather than a spot.
        var squareness = 0.55
        /// Under this it is a streak that merely spans a square.
        var fullness = 0.45
        /// Over this it is too strong to be a blemish. See `Blob.peak`.
        var strongest = 150
    }

    /// The blobs in a one-byte-per-pixel map, where anything at or above
    /// `threshold` is part of one.
    ///
    /// Iterative rather than recursive on purpose: a flood fill that recurses
    /// runs as deep as the blob is wide, and one frame with a long edge in it
    /// would take the stack out.
    static func find(
        in map: [UInt8],
        width: Int,
        height: Int,
        threshold: UInt8
    ) -> [Blob] {
        guard width > 0, height > 0, map.count >= width * height else { return [] }
        var seen = [Bool](repeating: false, count: width * height)
        var blobs: [Blob] = []
        var stack: [Int] = []

        for start in 0 ..< (width * height) where !seen[start] && map[start] >= threshold {
            stack.removeAll(keepingCapacity: true)
            stack.append(start)
            seen[start] = true

            var minX = width, maxX = 0, minY = height, maxY = 0, area = 0, peak = 0
            while let index = stack.popLast() {
                let x = index % width
                let y = index / width
                area += 1
                peak = max(peak, Int(map[index]))
                minX = min(minX, x)
                maxX = max(maxX, x)
                minY = min(minY, y)
                maxY = max(maxY, y)

                // Four-way, which is enough to hold a blob together and keeps
                // two spots that merely touch at a corner apart.
                if x > 0 { push(index - 1, &stack, &seen, map, threshold) }
                if x < width - 1 { push(index + 1, &stack, &seen, map, threshold) }
                if y > 0 { push(index - width, &stack, &seen, map, threshold) }
                if y < height - 1 { push(index + width, &stack, &seen, map, threshold) }
            }

            blobs.append(
                Blob(
                    bounds: CGRect(
                        x: minX,
                        y: minY,
                        width: maxX - minX + 1,
                        height: maxY - minY + 1
                    ),
                    area: area,
                    peak: peak
                )
            )
        }
        return blobs
    }

    private static func push(
        _ index: Int,
        _ stack: inout [Int],
        _ seen: inout [Bool],
        _ map: [UInt8],
        _ threshold: UInt8
    ) {
        guard !seen[index], map[index] >= threshold else { return }
        seen[index] = true
        stack.append(index)
    }

    /// The blobs that look like blemishes, of everything that was found.
    ///
    /// - Parameter faceWidth: how wide the face is in the same coordinates the
    ///   blobs were measured in, which is what the size rules are fractions of.
    static func blemishes(
        among blobs: [Blob],
        faceWidth: Double,
        rules: Rules = Rules()
    ) -> [Blob] {
        guard faceWidth > 0 else { return [] }
        let smallest = faceWidth * rules.smallest
        let largest = faceWidth * rules.largest
        return blobs.filter { blob in
            let size = blob.radius * 2
            return size >= smallest
                && size <= largest
                && blob.squareness >= rules.squareness
                && blob.fullness >= rules.fullness
                && blob.peak <= rules.strongest
        }
    }
}
