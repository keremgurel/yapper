import Foundation

/// What a Studio Chirpy turn changed on the server, as the web bridge reports
/// it in the reply's `effects`. Each one reloads the native stores that show
/// that data, but only stores that have loaded already: a tab the creator has
/// not opened reads fresh when it opens.
enum StudioChirpyEffects {
    @MainActor
    static func apply(_ effects: [String]) {
        if effects.contains("ideas") {
            Task {
                if IdeasStore.shared.items != nil { await IdeasStore.shared.refresh() }
                if CalendarStore.shared.items != nil { await CalendarStore.shared.refresh() }
            }
        }
        if effects.contains("ideaViews"), IdeaViewsStore.shared.views != nil {
            Task { await IdeaViewsStore.shared.reload() }
        }
        if effects.contains("brand"), BrandKitStore.shared.kit != nil {
            Task { await BrandKitStore.shared.refresh() }
        }
        if effects.contains("storage"), StorageStore.shared.usage != nil {
            Task { await StorageStore.shared.refresh() }
        }
        // The rule changed on the server, so the editor starts again from it
        // rather than keeping a draft of the old version.
        if effects.contains("automations"), AutomationStore.shared.response != nil {
            Task {
                if let response = await AutomationStore.shared.load() {
                    AutomationEditor.shared.reset(from: response)
                }
            }
        }
        if effects.contains("brain") {
            BrainPreviewStore.shared.invalidate()
            Task {
                if BrainProjectStore.shared.project != nil { await BrainProjectStore.shared.refresh(force: true) }
                if BrainBlocksStore.shared.blocks != nil { await BrainBlocksStore.shared.refresh() }
                if BrainSkillsStore.shared.skills != nil { await BrainSkillsStore.shared.refresh() }
                if BrainVoiceStore.shared.samples != nil { await BrainVoiceStore.shared.refresh() }
                if !IdeaPillarsStore.shared.pillars.isEmpty { await IdeaPillarsStore.shared.refresh() }
            }
        }
    }
}
