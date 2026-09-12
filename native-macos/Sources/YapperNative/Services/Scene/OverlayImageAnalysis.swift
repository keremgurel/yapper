import CoreGraphics
import Foundation
import Vision

struct OverlayImageRegion: Codable, Sendable {
    let kind: String
    let text: String?
    let rect: ActionRect
    let confidence: Double
}

/// Reusable source-image evidence for region selection, cropping and masking.
/// Observations are suggestions, never instructions or persistent mask IDs.
actor OverlayImageAnalysis {
    static let shared = OverlayImageAnalysis()

    func regions(in image: CGImage) -> [OverlayImageRegion] {
        let text = VNRecognizeTextRequest()
        text.recognitionLevel = .accurate
        text.usesLanguageCorrection = false
        text.minimumTextHeight = 0.01
        let rectangles = VNDetectRectanglesRequest()
        rectangles.maximumObservations = 16
        rectangles.minimumConfidence = 0.7
        rectangles.minimumSize = 0.02
        rectangles.minimumAspectRatio = 0.05
        rectangles.maximumAspectRatio = 1
        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        // Text and shapes fail independently; vision failure is not invented geometry.
        try? handler.perform([text])
        try? handler.perform([rectangles])
        func rect(_ box: CGRect) -> ActionRect {
            .init(x: box.minX, y: 1 - box.maxY, width: box.width, height: box.height)
        }
        let words = (text.results ?? []).prefix(48).compactMap { observation -> OverlayImageRegion? in
            guard let candidate = observation.topCandidates(1).first, candidate.confidence >= 0.5 else { return nil }
            return .init(kind: "text", text: candidate.string, rect: rect(observation.boundingBox), confidence: Double(candidate.confidence))
        }
        return words + (rectangles.results ?? []).map {
            .init(kind: "rectangle", text: nil, rect: rect($0.boundingBox), confidence: Double($0.confidence))
        }
    }
}
