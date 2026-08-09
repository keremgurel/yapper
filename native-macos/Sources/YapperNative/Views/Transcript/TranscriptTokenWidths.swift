import AppKit
import Foundation

/// How wide each transcript token draws.
///
/// Measuring a string with Core Text costs about a microsecond, against roughly
/// fifty for building the SwiftUI view that would have measured itself. That
/// difference is what lets the transcript work out its own wrapping and then
/// build only the lines on screen.
///
/// Widths are cached by text: a transcript repeats "the" and "and" hundreds of
/// times, and the cache is small because it holds strings, not views.
@MainActor
enum TranscriptTokenWidths {
    private static var cache: [Key: Double] = [:]

    private struct Key: Hashable {
        let text: String
        let fontSize: Double
        let weight: Double
    }

    /// Total drawn width of a token: its text plus the padding the cell adds.
    static func width(of text: String, font: NSFont, padding: Double) -> Double {
        let key = Key(
            text: text,
            fontSize: font.pointSize,
            weight: font.fontDescriptor.object(forKey: .face) as? Double ?? 0
        )
        if let cached = cache[key] { return cached + padding }
        let measured = (text as NSString)
            .size(withAttributes: [.font: font])
            .width
            .rounded(.up)
        cache[key] = measured
        return measured + padding
    }

    static func widths(of texts: [String], font: NSFont, padding: Double) -> [Double] {
        texts.map { width(of: $0, font: font, padding: padding) }
    }

    /// Dropped when the transcript is replaced, so a long session does not keep
    /// every word it has ever shown.
    static func forget() {
        cache.removeAll()
    }
}
