import SwiftUI

/// A skill, open for editing. "When to use it" does the most work: it is what
/// the router reads before deciding whether to load the instructions at all.
struct BrainSkillEditorSheet: View {
    let skillID: String
    let onClose: () -> Void

    @ObservedObject private var store = BrainSkillsStore.shared
    @State private var resetting = false
    @State private var resetError: String?
    @State private var confirmingReset = false

    var body: some View {
        if let skill = store.skill(skillID) {
            BrainEditorPanel(
                title: skill.name.isEmpty ? "Edit skill" : skill.name,
                description: skill.catalogSlug == nil
                    ? "Yours, written from scratch."
                    : "Your editable copy. You can always restore Yapper's original.",
                onClose: onClose
            ) {
                if let resetError { BrainInlineError(message: resetError) }
                fields(skill).disabled(resetting)
                if skill.catalogSlug != nil { origin(skill) }
            } main: {
                Text("Instructions").font(.nativeLabel).foregroundStyle(.secondary)
                BrainLongTextEditor(
                    text: Binding(get: { skill.instructions }, set: { store.edit(skill.id, .instructions($0)) }),
                    placeholder: "Write it as instructions to whoever is doing the writing."
                )
                .disabled(resetting)
            }
            .confirmationDialog(
                "Reset \u{201C}\(skill.name)\u{201D} to Yapper's current default?",
                isPresented: $confirmingReset
            ) {
                Button("Reset", role: .destructive) { reset(skill) }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Your edits to this skill will be replaced.")
            }
        } else {
            BrainEditorPanel(title: "Edit skill", onClose: onClose) {
                Text("This skill isn't here anymore.").font(.system(size: 13)).foregroundStyle(.secondary)
            } main: { EmptyView() }
        }
    }

    @ViewBuilder
    private func fields(_ skill: BrainSkill) -> some View {
        NativeField(label: "Name") {
            TextField("", text: Binding(get: { skill.name }, set: { store.edit(skill.id, .name($0)) }))
                .textFieldStyle(.native)
        }
        NativeField(label: "When to use it") {
            VStack(alignment: .leading, spacing: 4) {
                TextField("The idea is a personal story or a case study", text: Binding(get: { skill.whenToUse }, set: { store.edit(skill.id, .whenToUse($0)) }))
                    .textFieldStyle(.native)
                Text("This line decides whether the skill gets pulled into a piece of writing. Say what has to be true, not what the skill does.")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
            }
        }
        NativeField(label: "Use for") {
            VStack(alignment: .leading, spacing: 6) {
                BrainFlowLayout {
                    ForEach(IdeaCanvasVersionFormat.allCases) { format in
                        BrainToggleChip(text: format.label, on: skill.versionFormats.contains(format)) {
                            toggle(format, in: skill)
                        }
                    }
                }
                Text(skill.versionFormats.isEmpty ? "Nothing picked, so it shapes every format." : "Only shapes these formats.")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
            }
        }
        NativeField(label: "Where it applies") {
            VStack(alignment: .leading, spacing: 6) {
                BrainFlowLayout {
                    ForEach(BrainSurface.allCases) { surface in
                        BrainToggleChip(text: surface.label, on: skill.surfaces.contains(surface.rawValue)) {
                            toggle(surface, in: skill)
                        }
                    }
                }
                Text(skill.surfaces.isEmpty ? "Nothing picked, so it is considered everywhere." : "Only considered on these.")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
            }
        }
    }

    private func origin(_ skill: BrainSkill) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(skill.isStarter ? "Included by Yapper" : "Installed from Skills").font(.system(size: 13, weight: .semibold))
                Text(skill.customized
                     ? "You've customized this copy. Reset restores the latest official version."
                     : "This matches the official version. You can edit it freely.")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button { confirmingReset = true } label: {
                HStack(spacing: 5) {
                    if resetting { ProgressView().controlSize(.mini) } else { Image(systemName: "arrow.counterclockwise") }
                    Text("Reset to default")
                }
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(resetting)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .nativeWell()
    }

    private func toggle(_ surface: BrainSurface, in skill: BrainSkill) {
        let next = skill.surfaces.contains(surface.rawValue)
            ? skill.surfaces.filter { $0 != surface.rawValue }
            : skill.surfaces + [surface.rawValue]
        store.edit(skill.id, .surfaces(next))
    }

    private func toggle(_ format: IdeaCanvasVersionFormat, in skill: BrainSkill) {
        let current = skill.versionFormats
        let next = current.contains(format) ? current.filter { $0 != format } : current + [format]
        store.edit(skill.id, .formats(IdeaCanvasVersionFormat.allCases.filter(next.contains).map(\.rawValue)))
    }

    private func reset(_ skill: BrainSkill) {
        resetting = true
        resetError = nil
        Task {
            defer { resetting = false }
            do { try await store.reset(skill) } catch { resetError = "The default couldn't be restored. Try again." }
        }
    }
}
