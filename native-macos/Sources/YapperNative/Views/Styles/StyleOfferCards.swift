import SwiftUI

/// The templates Chirpy offered, as cards drawn on the creator's own video.
/// Tapping one applies it to the stretch the offer was for.
struct StyleOfferCards: View {
    @ObservedObject var session: EditorSession
    let offer: StyleOffer
    let messageID: UUID

    private var plans: [StyleTemplatePlan] {
        offer.templateIDs.compactMap(StyleTemplateCatalog.bundled.template)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(offer.chosen == nil ? "For \(StyleOfferLabel.range(offer))" : "Applied to \(StyleOfferLabel.range(offer))")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
            HStack(alignment: .top, spacing: 8) {
                ForEach(plans, id: \.id) { plan in
                    StyleOfferCard(
                        session: session,
                        plan: plan,
                        offer: offer,
                        isChosen: offer.chosen == plan.id
                    ) {
                        Task { await session.chooseOfferedStyle(plan.id, from: offer, in: messageID) }
                    }
                }
            }
        }
    }
}

/// One template: a still of the result and its name. Used by Chirpy's cards
/// and by the Styles tab.
struct StyleOfferCard: View {
    @ObservedObject var session: EditorSession
    let plan: StyleTemplatePlan
    let offer: StyleOffer
    let isChosen: Bool
    let choose: () -> Void

    @State private var still: CGImage?

    var body: some View {
        Button(action: choose) {
            VStack(alignment: .leading, spacing: 5) {
                ZStack {
                    Color.studioFaintFill
                    if let still {
                        Image(decorative: still, scale: 1).resizable().scaledToFill()
                    } else {
                        ProgressView().controlSize(.small)
                    }
                }
                .frame(width: 76, height: 135)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(isChosen ? Color.yapperOrange : Color.studioLine, lineWidth: isChosen ? 2 : 1)
                }
                HStack(spacing: 4) {
                    if isChosen { Image(systemName: "checkmark").font(.studioMicro) }
                    Text(plan.name).font(.studioCaption).lineLimit(1)
                }
                .frame(width: 76, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
        .help(plan.summary)
        .task(id: "\(offer.start)-\(offer.end)-\(session.project.updatedAt.timeIntervalSince1970)") {
            still = await StyleThumbnailRenderer.still(
                of: plan, offer: offer, project: session.project, playhead: session.currentTime
            )
        }
    }
}
