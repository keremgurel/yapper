@preconcurrency import AppKit
import Foundation
import Vision

/// Reads the existing pixels locally. This never redraws or invents a metric.
actor ImageNumberRevealService {
    struct Prepared: Sendable {
        let regions: [Region]
        let png: Data
    }
    struct Region: Sendable {
        let text: String
        let value: Double
        let currency: Bool
        let box: CGRect // Fractions, measured from the top left of the image.
        let background: StudioColor
    }

    func prepare(_ url: URL) throws -> Prepared {
        try Task.checkCancellation()
        guard let original = NSBitmapImageRep(data: try Data(contentsOf: url))?.cgImage,
              original.width <= 8192, original.height <= 8192,
              let context = CGContext(data: nil, width: original.width, height: original.height,
                                      bitsPerComponent: 8, bytesPerRow: 0,
                                      space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
            throw NativeEditorError.aiFailed("This image could not be read.")
        }
        // Sample and save the same sRGB pixels. Sampling AppKit's calibrated
        // colors while saving its raw PNG pixels gives visibly different masks.
        context.draw(original, in: CGRect(x: 0, y: 0, width: original.width, height: original.height))
        guard let image = context.makeImage() else { throw NativeEditorError.aiFailed("This image could not be read.") }
        let bitmap = NSBitmapImageRep(cgImage: image)
        guard let png = bitmap.representation(using: .png, properties: [:]) else {
            throw NativeEditorError.aiFailed("This image could not be prepared.")
        }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        try VNImageRequestHandler(cgImage: image).perform([request])
        var regions: [Region] = []
        for observation in request.results ?? [] {
            try Task.checkCancellation()
            guard let text = observation.topCandidates(1).first?.string, text.contains(where: \.isNumber) else { continue }
            guard let value = ImageNumberReveal.number(text) else {
                throw NativeEditorError.aiFailed("A number is mixed into a label or sentence in this image. I couldn’t isolate every value cleanly, so nothing was changed.")
            }
            guard observation.confidence >= 0.5 else {
                throw NativeEditorError.aiFailed("A number in this image could not be read confidently. Nothing was changed.")
            }
            let r = observation.boundingBox
            let pixels = CGRect(x: r.minX * Double(image.width), y: (1 - r.maxY) * Double(image.height),
                                width: r.width * Double(image.width), height: r.height * Double(image.height))
                .insetBy(dx: -4, dy: -4).integral.intersection(CGRect(x: 0, y: 0, width: image.width, height: image.height))
            guard let color = Self.background(around: pixels, bitmap: bitmap) else {
                throw NativeEditorError.aiFailed("The numbers sit on a detailed background. I couldn’t hide them cleanly without changing the image.")
            }
            regions.append(.init(text: text, value: value, currency: text.contains(where: { "$€£".contains($0) }),
                box: CGRect(x: pixels.minX / Double(image.width), y: pixels.minY / Double(image.height),
                            width: pixels.width / Double(image.width), height: pixels.height / Double(image.height)), background: color))
        }
        guard !regions.isEmpty, regions.count <= 32 else {
            throw NativeEditorError.aiFailed("I couldn’t identify a small set of readable numbers in this image. Nothing was changed.")
        }
        return Prepared(regions: regions.sorted { $0.box.minX < $1.box.minX }, png: png)
    }

    private static func background(around box: CGRect, bitmap: NSBitmapImageRep) -> StudioColor? {
        let points = [CGPoint(x: box.minX, y: box.minY), CGPoint(x: box.maxX - 1, y: box.minY),
                      CGPoint(x: box.minX, y: box.maxY - 1), CGPoint(x: box.maxX - 1, y: box.maxY - 1)]
        guard bitmap.bitsPerSample == 8, bitmap.samplesPerPixel == 4 else { return nil }
        let colors = points.map { point in
            var pixel = [UInt](repeating: 0, count: 4)
            bitmap.getPixel(&pixel, atX: Int(point.x), y: Int(point.y))
            // colorAt returns a calibrated NSColor even for an sRGB bitmap;
            // converting that again changes the color. These bytes are already
            // in the explicit sRGB space prepared above.
            return StudioColor(red: Double(pixel[0]) / 255, green: Double(pixel[1]) / 255,
                               blue: Double(pixel[2]) / 255, opacity: Double(pixel[3]) / 255)
        }
        guard colors.count == points.count, let first = colors.first,
              colors.allSatisfy({ abs($0.red - first.red) < 0.04 &&
                  abs($0.green - first.green) < 0.04 && abs($0.blue - first.blue) < 0.04 && $0.opacity > 0.99 }) else { return nil }
        return first
    }
}

enum ImageNumberReveal {
    struct Cue: Sendable {
        let region: Int
        let at: Double
        let end: Double
        let spoken: String
    }

    static func requested(_ instruction: String) -> Bool {
        let text = instruction.lowercased()
        return text.range(of: #"\b(reveal|show|appear|uncover)\b"#, options: .regularExpression) != nil &&
            text.range(of: #"\b(numbers?|figures?|metrics?|stats|values?)\b"#, options: .regularExpression) != nil &&
            text.range(of: #"\b(say|saying|speak|spoken|mention|read|voice|narration)\b"#, options: .regularExpression) != nil
    }

    static func number(_ text: String) -> Double? {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.range(of: #"^(?:[A-Z]{1,3}\s*)?[$€£]?\s*-?\d[\d,]*(?:\.\d+)?%?$"#, options: .regularExpression) != nil else { return nil }
        let digits = text.filter { "0123456789.-".contains($0) }
        return Double(digits).flatMap { $0.isFinite ? $0 : nil }
    }

    @MainActor
    static func cues(regions: [ImageNumberRevealService.Region], words: [TimelineInspectionService.TimedWord],
                     overlay: ProjectOverlay, projectDuration: Double) -> [Cue] {
        let limit = min(projectDuration, overlay.timelineStart + min(30, max(12, overlay.duration + 8)))
        let words = words.filter { $0.at >= overlay.timelineStart - 0.15 && $0.at < limit }
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.numberStyle = .spellOut
        let numericWords = Set("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion point and minus".split(separator: " ").map(String.init))
        var phrases: [(value: Double, at: Double, end: Double, text: String)] = []
        var index = 0
        while index < words.count {
            let clean = words[index].text.trimmingCharacters(in: CharacterSet(charactersIn: ".,!?;:"))
            if let value = number(clean) {
                phrases.append((value, words[index].at, words[index].end, words[index].text))
                index += 1
                continue
            }
            var count = 0
            while index + count < words.count, count < 8 {
                let token = words[index + count].text.lowercased().trimmingCharacters(in: .punctuationCharacters)
                guard numericWords.contains(token), token != "and" || count > 0 else { break }
                if count > 0, words[index + count].at - words[index + count - 1].end > 0.5 { break }
                count += 1
            }
            if count > 0 {
                while count > 0, words[index + count - 1].text.lowercased() == "and" { count -= 1 }
                let span = words[index..<(index + count)]
                let text = span.map(\.text).joined(separator: " ")
                let clean = text.lowercased().trimmingCharacters(in: .punctuationCharacters)
                    .replacingOccurrences(of: #"\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety) (one|two|three|four|five|six|seven|eight|nine)\b"#,
                                          with: "$1-$2", options: .regularExpression)
                func normalized(_ value: String) -> [String] {
                    value.replacingOccurrences(of: "-", with: " ").split(separator: " ").map(String.init).filter { $0 != "and" }
                }
                if count > 0, let parsed = formatter.number(from: clean),
                   let canonical = formatter.string(from: parsed), normalized(canonical) == normalized(clean) {
                    let value = parsed.doubleValue
                    phrases.append((value, words[index].at, words[index + count - 1].end, text))
                }
            }
            // Never match "four" inside "thirty four" or "three" inside
            // "three hundred" as a separate metric.
            index += max(1, count)
        }
        var result: [Cue] = []
        for (regionIndex, region) in regions.enumerated() {
            if let phrase = phrases.first(where: { phrase in
                let exact = abs(phrase.value - region.value) < 0.000_001
                // Screenshots can include cents while speech rounds dollars.
                // Counts and percentages must match exactly.
                let roundedCurrency = region.currency && phrase.value.rounded() == phrase.value &&
                    region.value.rounded() == phrase.value && phrase.text.contains("$")
                return exact || roundedCurrency
            }) {
                result.append(.init(region: regionIndex, at: max(overlay.timelineStart, phrase.at),
                                    end: phrase.end, spoken: phrase.text))
            }
        }
        return result.sorted { $0.at < $1.at }
    }

    static func scene(regions: [ImageNumberRevealService.Region], cues: [Cue], start: Double, duration: Double) -> OverlayScene {
        var image = SceneNode(id: "original", kind: .image, x: 0, y: 0, width: 1, height: 1)
        image.asset = "image:original"
        image.fit = .contain
        var nodes = [image]
        var animations: [SceneAnimation] = []
        for (index, region) in regions.enumerated() {
            // Only cover values that have a spoken cue to uncover them.
            // An unmatched value is part of the original image throughout;
            // timing the spoken numbers must not erase unrelated metrics.
            guard let cue = cues.first(where: { $0.region == index }) else { continue }
            let box = region.box
            var cover = SceneNode(id: "number-\(index)", kind: .rect,
                                  x: box.minX, y: box.minY, width: box.width, height: box.height)
            cover.fill = .hex(region.background)
            nodes.append(cover)
            let at = max(0, cue.at - start)
            animations.append(.init(node: cover.id, property: .opacity, from: 1, to: 0,
                                    start: at, end: min(duration, at + 0.16), easing: .outCubic))
        }
        return OverlayScene(duration: duration, poster: min(duration - 0.04, (cues.last?.at ?? start) - start + 0.3),
                            nodes: nodes, animations: animations)
    }
}
