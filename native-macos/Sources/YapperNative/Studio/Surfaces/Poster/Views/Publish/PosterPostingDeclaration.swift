import SwiftUI

/// The one declaration a press of publish needs: the creator has reviewed
/// the video and agrees to the policies TikTok names for a Direct Post. It
/// sits beside the publish button, so nothing a press needs is tucked away
/// in the settings sheet.
struct PosterPostingDeclaration: View {
    @Binding var agreed: Bool
    /// Branded content brings TikTok's Branded Content Policy into the text.
    let brandedContent: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle(Self.text(brandedContent: brandedContent), isOn: $agreed)
                .toggleStyle(.checkbox)
                .font(.studioBody)
                .fixedSize(horizontal: false, vertical: true)
                .clickableCursor()
            HStack(spacing: 12) {
                if brandedContent {
                    Link("Branded Content Policy", destination: URL(string: "https://www.tiktok.com/legal/page/global/bc-policy/en")!)
                }
                Link("Music Usage Confirmation", destination: URL(string: "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en")!)
            }
            .font(.studioLabel)
            .clickableCursor()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    static func text(brandedContent: Bool) -> String {
        "I reviewed this video and authorize posting. By posting, you agree to TikTok’s "
            + (brandedContent ? "Branded Content Policy and " : "") + "Music Usage Confirmation."
    }
}
