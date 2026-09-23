import SwiftUI

/// The bottom of the rule: the on switch, what enabling and pausing mean,
/// the save, and what the saved rule is doing.
struct AutomationSaveArea: View {
    let response: AutomationResponse
    @Binding var draft: AutomationDraft
    @ObservedObject var editor: AutomationEditor
    let missingAccount: Bool
    let locked: Bool
    let onSave: () -> Void
    let onReload: () -> Void

    private var saveBlocked: Bool {
        missingAccount || (draft.enabled && (!response.available || draft.settings.destinations.isEmpty))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            AutomationSwitchRow(
                title: "Enable automatic sending",
                isOn: $draft.enabled,
                disabled: locked || (!response.available && !draft.enabled)
            )
            AutomationNote(text: "Changes take effect when saved. Enabling starts with videos posted from that moment. Old posts and videos posted while paused are not backfilled. Existing prepared deliveries keep their original settings.")
            AutomationNote(text: "Pausing cancels waiting imports and deliveries. Sending already underway may finish. TikTok always receives a draft.")
            if missingAccount {
                HStack(spacing: 8) {
                    AutomationNote(text: "Connect Instagram and every selected destination before enabling.", danger: true, size: 13)
                    Button("Open Connections") { StudioNavigation.shared.goTo(.connections) }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                }
            }
            Button(action: onSave) {
                HStack(spacing: 6) {
                    if editor.saving { ProgressView().controlSize(.small) }
                    Text(editor.saving ? "Saving…" : draft.enabled ? "Save and enable" : "Save while paused")
                }
            }
            .buttonStyle(EditorPrimaryButtonStyle())
            .disabled(saveBlocked || locked)
            .padding(.top, 4)
            statusLines
        }
    }

    @ViewBuilder
    private var statusLines: some View {
        if editor.saved {
            Label(
                response.rule?.enabled == true
                    ? "Saved. New Instagram videos will be checked automatically."
                    : "Saved. This automation is paused.",
                systemImage: "checkmark"
            )
            .font(.system(size: 13))
        }
        if let error = editor.error {
            VStack(alignment: .leading, spacing: 8) {
                AutomationNote(text: error, danger: true, size: 13)
                Button("Reload saved settings", action: onReload)
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                    .disabled(editor.saving)
            }
        }
        if let code = response.rule?.error {
            AutomationNote(text: AutomationErrorCopy.message(forCode: code), danger: true, size: 13)
        }
        if let rule = response.rule {
            AutomationNote(text: savedRuleLine(rule))
        }
    }

    private func savedRuleLine(_ rule: AutomationRule) -> String {
        let state = rule.enabled ? "Enabled" : "Paused"
        guard let checked = StudioISODate.parse(rule.lastCheckedAt) else {
            return "Saved rule: \(state) · No check completed yet"
        }
        return "Saved rule: \(state) · Last checked \(checked.formatted(date: .abbreviated, time: .shortened))"
    }
}
