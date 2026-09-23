import Foundation

/// What each platform wants from a caption. Mirrors `lib/publish/caption-specs.ts`.
struct PosterCaptionSpec {
    let label: String
    let hasTitle: Bool
    let titleMax: Int
    let bodyMax: Int
    /// How much of the body shows before the platform collapses it.
    let visibleChars: Int
    let hashtagMin: Int
    let hashtagMax: Int

    static func of(_ platform: PublishPlatform) -> PosterCaptionSpec {
        switch platform {
        case .youtube:
            PosterCaptionSpec(label: "YouTube Shorts", hasTitle: true, titleMax: 100, bodyMax: 5000, visibleChars: 100, hashtagMin: 2, hashtagMax: 4)
        case .facebook:
            PosterCaptionSpec(label: "Facebook Reels", hasTitle: false, titleMax: 0, bodyMax: 2200, visibleChars: 125, hashtagMin: 0, hashtagMax: 3)
        case .instagram:
            PosterCaptionSpec(label: "Instagram Reels", hasTitle: false, titleMax: 0, bodyMax: 2200, visibleChars: 125, hashtagMin: 3, hashtagMax: 8)
        case .tiktok:
            PosterCaptionSpec(label: "TikTok", hasTitle: false, titleMax: 0, bodyMax: 2200, visibleChars: 90, hashtagMin: 2, hashtagMax: 5)
        }
    }
}

/// The standing caption prompt. Same text as `DEFAULT_CAPTION_BRIEF` on the web.
enum PosterCaptionBrief {
    static let standard = "Write a fully optimized caption for each selected platform based on what is actually said in this video. Make the opening line strong enough to stop the scroll without repeating the video's spoken hook. Keep the voice natural, specific, and human, never generic marketing copy. Adapt the structure and call to action to each platform instead of reusing the same caption. Include the ideal number of relevant, specific hashtags for each platform, mixing topic, audience, and intent tags; never use filler tags such as #fyp unless they are genuinely relevant. For YouTube Shorts, also write a concise, searchable title with the concrete topic and a credible curiosity gap, plus a useful description. Do not invent claims, outcomes, links, or offers that are not supported by the transcript or creator context."
}
