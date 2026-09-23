import CoreGraphics
import Foundation

/// The cover a post ships with. One cover serves every platform.
struct PosterCoverDraft {
    enum Source: Equatable { case frame, generated, uploaded, original }
    enum TextStyle: String, CaseIterable { case shadow, label }
    enum Position: String, CaseIterable { case top, center, bottom }

    /// The frame under the playhead, kept even while another image is in use.
    var frameImage: CGImage?
    var frameTime: Double = 1
    /// What ships.
    var image: CGImage?
    var source: Source = .frame
    var headline = ""
    var showHeadline = false
    var textStyle: TextStyle = .shadow
    var position: Position = .bottom

    func withFrame(_ image: CGImage, at time: Double) -> PosterCoverDraft {
        var next = self
        next.frameImage = image
        next.frameTime = time
        if source == .frame { next.image = image }
        return next
    }

    var hasHeadline: Bool {
        showHeadline && !headline.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

enum PosterThumbnailPrompt {
    static let standard = "Create a high-impact vertical social-video thumbnail. Keep the person recognizable and identity-faithful. Make the main subject large, expressive, and immediately readable on a phone. Improve lighting, separation, color, and contrast while keeping the result believable. Simplify distracting background details and leave useful negative space for an optional headline. Do not add text, logos, borders, or watermarks."
}
