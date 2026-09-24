import SwiftUI

/// One skill the creator has, as a card. Every card has the same shape: the
/// name with its switch, two lines on when it's used, then one footer line
/// with where it applies, where it came from, and a menu. Clicking anywhere
/// else on the card opens it for editing.
struct BrainSkillCard: View {
    let skill: BrainSkill
    let removing: Bool
    let onToggle: (Bool) -> Void
    let onOpen: () -> Void
    let onRemove: () -> Void

    @State private var hovering = false
    @State private var confirmingRemove = false

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 0) {
                Text(skill.name.isEmpty ? "Untitled skill" : skill.name)
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(1)
                    .padding(.trailing, 44)
                Text(skill.whenToUse.isEmpty ? "No \u{201C}when to use it\u{201D} yet, so Yapper can't tell when to pick it." : skill.whenToUse)
                    .font(.system(size: 12.5))
                    .foregroundStyle(skill.whenToUse.isEmpty ? .tertiary : .secondary)
                    .lineLimit(2, reservesSpace: true)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(1.5)
                    .padding(.top, 5)
                Rectangle().fill(Color.studioLine).frame(height: 1).padding(.vertical, 12)
                HStack(spacing: 8) {
                    BrainSkillScope(skill: skill)
                    Spacer(minLength: 8)
                    Text(origin).font(.system(size: 11.5)).foregroundStyle(.tertiary).lineLimit(1)
                    Color.clear.frame(width: 24, height: 20)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .overlay(alignment: .topTrailing) {
            Toggle("", isOn: Binding(get: { skill.enabled }, set: { onToggle($0) }))
                .toggleStyle(.switch)
                .controlSize(.mini)
                .tint(Color.yapperOrange)
                .labelsHidden()
                .clickableCursor()
                .help(skill.enabled ? "On: Yapper can use this skill" : "Off: Yapper ignores this skill")
                .accessibilityLabel("\(skill.enabled ? "Turn off" : "Turn on") \(skill.name)")
                .padding(.top, 14)
                .padding(.trailing, 14)
        }
        .overlay(alignment: .bottomTrailing) {
            menu.padding(.trailing, 10).padding(.bottom, 12)
        }
        .background {
            let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
            shape.fill(hovering ? Color.studioFaintFill : Color.panelBackground)
                .overlay { shape.strokeBorder(hovering ? Color.studioLineStrong : Color.studioLine, lineWidth: 1) }
        }
        .opacity(skill.enabled ? 1 : 0.55)
        .onHover { hovering = $0 }
        .animation(.easeOut(duration: 0.12), value: hovering)
        .confirmationDialog("Delete \u{201C}\(skill.name)\u{201D}?", isPresented: $confirmingRemove) {
            Button("Delete", role: .destructive, action: onRemove)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Yapper stops using it. This can't be undone.")
        }
    }

    private var origin: String {
        switch (skill.isStarter, skill.customized) {
        case (true, true): "Yapper default, edited"
        case (true, false): "Yapper default"
        case (false, _): skill.catalogSlug == nil ? "Yours" : "From Discover"
        }
    }

    private var menu: some View {
        Menu {
            Button("Edit", action: onOpen)
            Button(skill.enabled ? "Turn off" : "Turn on") { onToggle(!skill.enabled) }
            if !skill.isStarter {
                Divider()
                Button("Delete", role: .destructive) { confirmingRemove = true }
            }
        } label: {
            Group {
                if removing {
                    ProgressView().controlSize(.mini)
                } else {
                    Image(systemName: "ellipsis").font(.system(size: 13, weight: .semibold))
                }
            }
            .foregroundStyle(.secondary)
            .frame(width: 24, height: 20)
            .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.studioPlain)
        .menuIndicator(.hidden)
        .fixedSize()
        .opacity(hovering ? 1 : 0.5)
        .clickableCursor()
        .help("More")
        .accessibilityLabel("More for \(skill.name)")
        .disabled(removing)
    }
}

/// Where a skill applies, as one quiet line: its formats as dots, then the
/// kinds of writing it's used for, in words.
struct BrainSkillScope: View {
    let skill: BrainSkill

    var body: some View {
        HStack(spacing: 8) {
            ForEach(skill.versionFormats) { format in
                HStack(spacing: 4) {
                    Circle().fill(format.tone.color).frame(width: 6, height: 6)
                    Text(format.label)
                }
                .foregroundStyle(.primary.opacity(0.85))
            }
            Text(surfaces).foregroundStyle(.secondary)
        }
        .font(.system(size: 11.5, weight: .medium))
        .lineLimit(1)
    }

    private var surfaces: String {
        let labels = skill.surfaces.compactMap { BrainSurface(rawValue: $0)?.label }
        return labels.isEmpty ? "Everywhere" : labels.joined(separator: " · ")
    }
}
