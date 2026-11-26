import SwiftUI

/// The style library's ready-made looks, each drawn on this video. One tap
/// lays it over the whole video or over the sentence under the playhead.
/// Everything after that is done on the canvas or by asking Chirpy, so this
/// pane holds no settings of its own.
struct StylesWorkbench: View {
    @ObservedObject var session: EditorSession
    @State private var scope: StyleScope = .wholeVideo

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                if session.project.clips.isEmpty {
                    Text("Import a video to try a look on it.")
                        .font(.studioBody)
                        .foregroundStyle(.secondary)
                } else {
                    InspectorSegmentedControl(
                        options: StyleScope.allCases.map { .init(value: $0, label: $0.label) },
                        selection: scope,
                        onSelect: { scope = $0 }
                    )
                    if let offer = offer {
                        Text("For \(StyleOfferLabel.range(offer))")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                        cards(offer)
                    } else {
                        Text("Transcribe the video to put a look on one sentence.")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .inspectorPane(maxWidth: 660)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("Styles")
                .font(.system(size: 15, weight: .bold))
            Text("Tap a look to use it. Or ask Chirpy, for example “split screen when I talk about pricing”.")
                .font(.studioBody)
                .foregroundStyle(.secondary)
        }
    }

    private func cards(_ offer: StyleOffer) -> some View {
        let onScreen = session.project.layoutSpan(atTimeline: session.currentTime)?.templateID ?? "talking-head"
        return LazyVGrid(columns: [GridItem(.adaptive(minimum: 80, maximum: 96), spacing: 10, alignment: .top)],
                         alignment: .leading, spacing: 12) {
            ForEach(StyleTemplateCatalog.bundled.templates, id: \.id) { plan in
                StyleOfferCard(session: session, plan: plan, offer: offer, isChosen: plan.id == onScreen) {
                    Task { await session.applyStyle(plan.id, to: offer) }
                }
            }
        }
    }

    /// The stretch a tap will cover.
    private var offer: StyleOffer? {
        let ids = StyleTemplateCatalog.bundled.templates.map(\.id)
        switch scope {
        case .wholeVideo:
            return StyleOffer(at: nil, until: nil, start: 0, end: session.duration, templateIDs: ids)
        case .sentence:
            guard let sentence = StyleRange.sentence(at: session.currentTime, in: session.project) else { return nil }
            let anchor = { (time: Double) in
                TimelineAnchorInput(kind: .time, time: time, phrase: nil, occurrence: nil, eventID: nil, offset: nil)
            }
            return StyleOffer(at: anchor(sentence.lowerBound), until: anchor(sentence.upperBound),
                              start: sentence.lowerBound, end: sentence.upperBound, templateIDs: ids)
        }
    }
}

/// How much of the video a tap in the Styles tab covers.
enum StyleScope: String, CaseIterable, Hashable {
    case wholeVideo
    case sentence

    var label: String {
        switch self {
        case .wholeVideo: "Whole video"
        case .sentence: "This sentence"
        }
    }
}
