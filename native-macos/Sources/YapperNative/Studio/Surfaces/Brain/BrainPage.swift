import SwiftUI

/// Essentials say who the creator is, Knowledge says what they know, and
/// Skills say how Yapper should work. Everything here is theirs to edit.
struct BrainPage: View {
    @ObservedObject private var project = BrainProjectStore.shared
    @ObservedObject private var blocks = BrainBlocksStore.shared
    @ObservedObject private var skills = BrainSkillsStore.shared
    @ObservedObject private var voice = BrainVoiceStore.shared

    @State private var tab: BrainTab = .essentials
    @State private var sheet: BrainSheet?
    @ObservedObject private var editor = BrainEditorRouter.shared

    var body: some View {
        NativePage() {
            NativePageHeader(
                title: "Brain",
                description: "What Yapper knows about you. Fill it in yourself, or let it read your videos or a document. Everything here is yours to edit."
            ) {
                BrainFillInMenu(videoCount: voice.count) { source in
                    switch source {
                    case .videos: sheet = .voice
                    case .document: sheet = .setup
                    case .chirpy: StudioWebCommands.shared.openAssistant(prompt: "Help me fill in my Brain: ")
                    }
                }
            }
            BrainErrorBanners()
            BrainTabBar(
                selection: $tab,
                knowledgeCount: blocks.blocks?.count ?? 0,
                skillsCount: skills.skills?.count ?? 0
            )
            .padding(.bottom, 24)
            content
        }
        .sheet(item: $sheet) { sheet in
            switch sheet {
            case .voice: BrainVoiceSheet { self.sheet = nil }
            case .setup: BrainSetupSheet { self.sheet = nil }
            case .addContext: BrainAddContextSheet { self.sheet = nil }
            case .catalog: BrainCatalogSheet { self.sheet = nil }
            }
        }
        .nativeModal(item: $editor.editing) { editing in
            switch editing {
            case .skill(let id): BrainSkillEditorSheet(skillID: id) { editor.editing = nil }
            case .block(let id): BrainBlockEditorPanel(blockID: id) { editor.editing = nil }
            }
        }
        .onDisappear { editor.editing = nil }
        .task {
            async let a: Void = project.refresh()
            async let b: Void = blocks.refresh()
            async let c: Void = skills.refresh()
            async let d: Void = voice.refresh()
            _ = await (a, b, c, d)
        }
        .onDisappear {
            Task {
                await project.flush()
                await blocks.flush()
                await skills.flush()
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch tab {
        case .essentials:
            BrainEssentialsView()
        case .knowledge:
            BrainKnowledgeTab { sheet = .addContext }
        case .skills:
            BrainSkillsTab(
                onDiscover: { sheet = .catalog },
                onOpen: { editor.editing = .skill($0) }
            )
        }
    }
}

enum BrainTab: Hashable { case essentials, knowledge, skills }

/// The one sheet the page shows at a time.
enum BrainSheet: Identifiable, Hashable {
    case voice, setup, addContext, catalog

    var id: String {
        switch self {
        case .voice: "voice"
        case .setup: "setup"
        case .addContext: "addContext"
        case .catalog: "catalog"
        }
    }
}
