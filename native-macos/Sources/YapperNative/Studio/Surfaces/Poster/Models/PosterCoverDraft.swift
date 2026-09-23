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

/// The starting prompt names what is attached, so it reads true until the
/// creator writes their own. The route's system prompt carries the rest.
enum PosterThumbnailPrompt {
    static func standard(frame: Bool, reference: Bool) -> String {
        let base = frame
            ? "Generate a 9:16 short-form video thumbnail from the attached frame."
            : "Generate a 9:16 short-form video thumbnail."
        guard reference else { return base }
        return base + " Make it look exactly like the reference thumbnail: same layout, text style, colors, and framing."
    }
}
