import SwiftUI

/// The one rule: repurpose new Instagram videos to the chosen destinations,
/// how the caption is reworked, and whether it runs.
struct AutomationRuleCard: View {
    let response: AutomationResponse
    @Binding var draft: AutomationDraft
    @ObservedObject var editor: AutomationEditor
    @ObservedObject var accounts: AutomationAccountsStore
    let onSave: () -> Void
    let onReload: () -> Void

    private var locked: Bool { editor.saving || response.setupAvailable == false }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Repurpose my Instagram videos").font(.nativeSectionTitle)
                AutomationNote(
                    text: "New videos from your connected Instagram account are imported and sent to your selected destinations.",
                    size: 13
                )
            }
            Divider()
            NativeField(label: "Source") {
                Text("Instagram · \(accounts.label("instagram"))")
                    .font(.system(size: 13, weight: .semibold))
            }
            NativeField(label: "Send new videos to") {
                HStack(spacing: 8) {
                    ForEach(AutomationDestination.allCases) { destination in
                        AutomationDestinationCard(
                            destination: destination,
                            accountLabel: accounts.label(destination.rawValue),
                            selected: draft.settings.destinations.contains(destination)
                        ) { draft.toggle(destination) }
                    }
                }
            }
            .disabled(locked)
            AutomationSwitchRow(
                title: "Strip hashtags", systemImage: "number",
                isOn: $draft.settings.stripHashtags, disabled: locked
            )
            AutomationSwitchRow(
                title: "Reformat for YouTube",
                detail: "Use the opening line as the title and the full caption as the description.",
                systemImage: "text.alignleft",
                isOn: $draft.settings.reformatForYouTube, disabled: locked
            )
            Divider()
            AutomationSaveArea(
                response: response, draft: $draft, editor: editor,
                missingAccount: accounts.missing(for: draft), locked: locked,
                onSave: onSave, onReload: onReload
            )
        }
        .nativeCard()
    }
}
