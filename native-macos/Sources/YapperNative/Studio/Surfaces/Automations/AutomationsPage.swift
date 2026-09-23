import AppKit
import SwiftUI

/// Automations: the Instagram repurpose rule and its recent activity.
struct AutomationsPage: View {
    @ObservedObject var store: AutomationStore = .shared
    @ObservedObject var editor: AutomationEditor = .shared
    @ObservedObject var accounts: AutomationAccountsStore = .shared

    var body: some View {
        NativePage() {
            NativePageHeader(
                title: "Automations",
                description: "Choose how new Instagram videos are reused on your connected channels."
            )
            content
        }
        .task { await load() }
        .task { await accounts.refresh() }
        .task(id: polling) { await poll() }
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in
            Task { await accounts.refresh() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let response = store.response, let draft = editor.draft {
            VStack(alignment: .leading, spacing: 20) {
                AutomationNotices(response: response, store: store, accounts: accounts)
                AutomationRuleCard(
                    response: response,
                    draft: Binding(get: { editor.draft ?? draft }, set: { editor.draft = $0 }),
                    editor: editor, accounts: accounts,
                    onSave: { Task { await editor.save(accounts: accounts.expectedAccounts, store: store) } },
                    onReload: { Task { await load() } }
                )
                AutomationHistorySection(runs: response.runs, store: store)
            }
        } else if store.loadFailed {
            NativeErrorState(message: "Your automation settings couldn't be loaded.") {
                Task { await load() }
            }
        } else {
            NativeLoadingState(label: "Loading your automation…")
        }
    }

    /// Poll only while the rule is live on a server that runs it.
    private var polling: Bool { store.canRetry }

    private func load() async {
        if let response = await store.load() { editor.reset(from: response) }
    }

    private func poll() async {
        guard polling else { return }
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(30))
            if Task.isCancelled { break }
            await store.refresh()
        }
    }
}

/// The server and account notices above the rule.
private struct AutomationNotices: View {
    let response: AutomationResponse
    @ObservedObject var store: AutomationStore
    @ObservedObject var accounts: AutomationAccountsStore

    var body: some View {
        if !response.available {
            AutomationNote(
                text: response.setupAvailable == false
                    ? "Automation setup isn't available on this server yet."
                    : "New video checks are paused on this server. Prepared deliveries may still send; pause the rule below to cancel waiting work.",
                size: 13
            )
            .padding(.horizontal, 16).padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.studioFaintFill))
        }
        if accounts.failed {
            NativeErrorState(message: "Your connected accounts couldn't be loaded.") {
                Task { await accounts.refresh() }
            }
        }
        if store.refreshFailed {
            AutomationNote(text: "Activity couldn't be refreshed. Your displayed settings are kept.", danger: true, size: 13)
        }
    }
}
