import SwiftUI

/// TikTok's review for one video, which TikTok requires before a Direct
/// Post: a playable preview, who is posting, the caption, the audience, what
/// others may do with it, commercial disclosure, and consent.
struct PosterTikTokReviewView: View {
    @StateObject private var model: PosterTikTokReviewModel
    let disabled: Bool
    let onChange: (String, PosterTikTokReview) -> Void

    init(target: PosterPublishTarget, disabled: Bool, onChange: @escaping (String, PosterTikTokReview) -> Void) {
        _model = StateObject(wrappedValue: PosterTikTokReviewModel(target: target))
        self.disabled = disabled
        self.onChange = onChange
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TikTok: \(model.target.title)").font(.system(size: 13, weight: .semibold)).lineLimit(1)
            preview
            Picker("Posting method", selection: $model.mode) {
                Text("Post to TikTok").tag(PosterTikTokReview.Mode.direct)
                Text("Send to TikTok inbox to finish there").tag(PosterTikTokReview.Mode.inbox)
            }
            .font(.system(size: 13))
            .clickableCursor()
            if model.mode == .inbox {
                note("We'll confirm inbox delivery. Open \"Your content from Yapper is ready\" in TikTok to add the caption and finish posting.")
            } else if let context = model.context {
                PosterTikTokDirectForm(model: model, context: context)
            } else if let error = model.contextError {
                note(error)
                Button("Reconnect TikTok for Direct Post") { model.reconnect() }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
            } else {
                NativeLoadingState(label: "Loading TikTok posting options")
            }
        }
        .disabled(disabled)
        .nativeCard(padding: 16, radius: 12)
        .task { await model.load() }
        .onChange(of: model.review) { _, review in onChange(model.target.id, review) }
    }

    @ViewBuilder
    private var preview: some View {
        if let preview = model.preview, let url = URL(string: preview.url) {
            PosterPreviewPlayer(url: url)
                .frame(height: 240)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        } else {
            note(model.previewError ?? "Loading video preview")
        }
    }

    private func note(_ text: String) -> some View {
        Text(text).font(.system(size: 12)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
    }
}

/// The Direct Post fields, once TikTok has said who is posting.
private struct PosterTikTokDirectForm: View {
    @ObservedObject var model: PosterTikTokReviewModel
    let context: PosterTikTokContext

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Posting as \(context.creator.creator_nickname) (@\(context.creator.creator_username))").font(.system(size: 13))
            if !context.audited {
                note("TikTok's review is pending. Test posts must use Only me and a private TikTok account. Public posting opens after approval.")
            }
            NativeField(label: "Caption") {
                NativeTextArea(text: $model.caption, font: .system(size: 13), minHeight: 72)
            }
            Picker("Who can see this video?", selection: $model.settings.privacy) {
                Text("Choose an audience").tag("")
                ForEach(model.privacyOptions, id: \.self) { option in
                    Text(PosterTikTokSettings.privacyLabels[option] ?? option).tag(option)
                }
            }
            .font(.system(size: 13))
            .clickableCursor()
            check("Allow comments", $model.settings.allowComment, blocked: context.creator.comment_disabled)
            check("Allow Duet", $model.settings.allowDuet, blocked: context.creator.duet_disabled)
            check("Allow Stitch", $model.settings.allowStitch, blocked: context.creator.stitch_disabled)
            check("Disclose commercial content", Binding(get: { model.settings.discloseCommercial }, set: { model.setCommercial($0) }), blocked: false)
            if model.settings.discloseCommercial { commercial.padding(.leading, 20) }
            check("Label this video as AI-generated", $model.settings.aiGenerated, blocked: false)
            if model.tooLong {
                Text("This video is too long. This account supports up to \(Int(context.creator.max_video_post_duration_sec)) seconds.")
                    .font(.system(size: 12)).foregroundStyle(Color.studioDanger)
            }
            check(consentText, $model.settings.consent, blocked: false)
            HStack(spacing: 12) {
                if model.settings.brandedContent {
                    Link("Branded Content Policy", destination: URL(string: "https://www.tiktok.com/legal/page/global/bc-policy/en")!)
                }
                Link("Music Usage Confirmation", destination: URL(string: "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en")!)
            }
            .font(.system(size: 12))
            .clickableCursor()
            note("Processing may take a few minutes before the post appears on your profile.")
        }
    }

    private var consentText: String {
        "I reviewed this video and authorize posting. By posting, I agree to TikTok's "
            + (model.settings.brandedContent ? "Branded Content Policy and " : "") + "Music Usage Confirmation."
    }

    private var commercial: some View {
        VStack(alignment: .leading, spacing: 8) {
            check("Your brand", $model.settings.ownBrand, blocked: false)
            check("Branded content", $model.settings.brandedContent, blocked: model.settings.privacy == "SELF_ONLY")
            if model.settings.privacy == "SELF_ONLY" { note("Branded content visibility cannot be set to private.") }
            if !model.settings.ownBrand && !model.settings.brandedContent {
                note("Say whether this promotes your brand, a third party, or both.")
            } else {
                note("Your video will be labeled as \"\(model.settings.brandedContent ? "Paid partnership" : "Promotional content")\".")
            }
        }
    }

    private func check(_ label: String, _ value: Binding<Bool>, blocked: Bool) -> some View {
        Toggle(blocked ? "\(label) (turned off in TikTok)" : label, isOn: value)
            .toggleStyle(.checkbox)
            .font(.system(size: 13))
            .disabled(blocked)
            .clickableCursor(enabled: !blocked)
    }

    private func note(_ text: String) -> some View {
        Text(text).font(.system(size: 12)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
    }
}
