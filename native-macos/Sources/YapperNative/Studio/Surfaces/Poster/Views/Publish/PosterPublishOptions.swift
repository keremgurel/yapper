import SwiftUI

/// What publishing needs beyond the captions, right under them: YouTube and
/// TikTok settings for the chosen destinations, when to send, and what
/// happened once it went.
struct PosterPublishOptions: View {
    let video: PosterVideo
    let chosen: [PublishPlatform]
    let youtubeDescriptionTooLong: Bool
    let showsWhen: Bool
    @ObservedObject var session: PosterPublishSession
    @ObservedObject var tiktok: PosterTikTokReviewModel
    @ObservedObject var schedule: PosterScheduleModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if chosen.contains(.youtube) {
                if youtubeDescriptionTooLong {
                    Text("Shorten the YouTube description to 5,000 bytes or fewer.")
                        .font(.system(size: 12, weight: .medium)).foregroundStyle(Color.studioDanger)
                        .fixedSize(horizontal: false, vertical: true)
                }
                PosterYouTubeSettingsView(settings: $session.youtube)
            }
            if chosen.contains(.tiktok) {
                PosterTikTokSettingsView(model: tiktok, video: video)
            }
            if showsWhen {
                PosterWhenPicker(model: schedule) { StudioNavigation.shared.goTo(.calendar) }
            }
            PosterOutcomeList(outcomes: session.outcomes)
        }
    }
}
