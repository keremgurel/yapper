import SwiftUI

/// The one way in for everything that writes the Brain for you.
struct BrainFillInMenu: View {
    enum Source { case videos, document, chirpy }

    let videoCount: Int
    let choose: (Source) -> Void

    @State private var open = false

    var body: some View {
        Button { open.toggle() } label: {
            HStack(spacing: 6) {
                Text("Fill in from")
                Image(systemName: "chevron.down").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
            }
        }
        .buttonStyle(EditorSecondaryButtonStyle())
        .popover(isPresented: $open, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: 0) {
                BrainMenuRow(systemImage: "video", title: "Your videos", trailing: videoCount > 0 ? "\(videoCount)" : nil) { pick(.videos) }
                BrainMenuRow(systemImage: "doc.text", title: "A document you wrote") { pick(.document) }
                BrainMenuRow(systemImage: "bubble.left", title: "A conversation with Chirpy") { pick(.chirpy) }
            }
            .padding(6)
            .frame(width: 260)
        }
    }

    private func pick(_ source: Source) {
        open = false
        choose(source)
    }
}

/// Essentials, Knowledge and Skills, with a quiet count on the lists.
struct BrainTabBar: View {
    @Binding var selection: BrainTab
    let knowledgeCount: Int
    let skillsCount: Int

    var body: some View {
        HStack(spacing: 4) {
            item(.essentials, "Essentials", count: nil)
            item(.knowledge, "Knowledge", count: knowledgeCount)
            item(.skills, "Skills", count: skillsCount)
            Spacer(minLength: 0)
        }
        .overlay(alignment: .bottom) { Rectangle().fill(Color.studioLine).frame(height: 1) }
    }

    private func item(_ tab: BrainTab, _ title: String, count: Int?) -> some View {
        let active = selection == tab
        return Button { selection = tab } label: {
            HStack(spacing: 6) {
                Text(title).font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(active ? Color.primary : Color.secondary)
                if let count {
                    Text("\(count)")
                        .font(.system(size: 11, weight: .medium).monospacedDigit())
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6).padding(.vertical, 1)
                        .background(Capsule().fill(Color.studioFaintFill))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .overlay(alignment: .bottom) {
                if active {
                    Capsule().fill(Color.yapperOrange).frame(height: 2).padding(.horizontal, 10)
                }
            }
        }
        .buttonStyle(.studioPlain)
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

/// One banner per part of the Brain that failed to load or save, each with
/// the retry that fixes it.
struct BrainErrorBanners: View {
    @ObservedObject private var project = BrainProjectStore.shared
    @ObservedObject private var blocks = BrainBlocksStore.shared
    @ObservedObject private var skills = BrainSkillsStore.shared

    var body: some View {
        VStack(spacing: 8) {
            if let message = projectMessage {
                NativeErrorState(message: message) { Task { await project.retry() } }
            }
            if let message = blocks.error ?? (blocks.saveState == .error ? "Your latest Knowledge edits couldn't be saved." : nil) {
                NativeErrorState(message: message) { Task { await blocks.retry() } }
            }
            if let message = skills.error ?? (skills.saveState == .error ? "Your latest Skill edits couldn't be saved." : nil) {
                NativeErrorState(message: message) { Task { await skills.retry() } }
            }
        }
        .padding(.bottom, hasAny ? 16 : 0)
    }

    private var projectMessage: String? {
        project.loadError ?? (project.saveState == .error ? "Your latest Essentials edits couldn't be saved." : nil)
    }

    private var hasAny: Bool {
        projectMessage != nil || blocks.error != nil || blocks.saveState == .error
            || skills.error != nil || skills.saveState == .error
    }
}
