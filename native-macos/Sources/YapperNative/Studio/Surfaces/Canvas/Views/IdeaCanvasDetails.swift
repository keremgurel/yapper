import SwiftUI

/// The facts about the piece that are not its words: pillar, what it ships
/// as, and the plan date once it is ready.
struct IdeaCanvasDetails: View {
    let item: IdeaCanvasItem
    let update: (IdeaCanvasPatch) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            IdeaCanvasSectionTitle("Details")
            VStack(alignment: .leading, spacing: 16) {
                NativeField(label: "Pillar") {
                    IdeaCanvasPillarMenu(pillarId: item.pillarId, legacyName: item.pillar) {
                        update(IdeaCanvasPatch(pillarId: IdeaCanvasNullable($0)))
                    }
                }
                NativeField(label: "Ships as") {
                    IdeaCanvasFormatToggles(formats: item.formats) { update(IdeaCanvasPatch(formats: $0)) }
                }
                if item.status == .ready {
                    NativeField(label: "Scheduled") {
                        IdeaCanvasScheduleField(scheduledFor: item.scheduledFor) {
                            update(IdeaCanvasPatch(scheduledFor: $0))
                        }
                    }
                }
            }
        }
    }
}

/// The creator's pillars as a chip that opens the list. A legacy free-text
/// pillar shows as the current value until a real one is chosen.
struct IdeaCanvasPillarMenu: View {
    let pillarId: String?
    let legacyName: String?
    let onChange: (String?) -> Void
    @ObservedObject private var pillars = IdeaCanvasPillarStore.shared

    var body: some View {
        let linked = pillars.pillars.first { $0.id == pillarId }
        let none = (linked == nil ? legacyName : nil) ?? "No pillar"
        IdeaCanvasPopoverMenu(
            options: [IdeaCanvasMenuOption(id: "", title: none, checked: linked == nil) { onChange(nil) }]
                + pillars.pillars.map { pillar in
                    IdeaCanvasMenuOption(id: pillar.id, title: pillar.name, checked: pillar.id == pillarId) {
                        onChange(pillar.id)
                    }
                },
            width: 220
        ) {
            HStack(spacing: 4) {
                Text(linked?.name ?? none).lineLimit(1)
                Image(systemName: "chevron.down").font(.system(size: 11))
            }
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 12)
            .frame(height: 28)
            .frame(maxWidth: 220)
            .background(Capsule().fill(Color.studioFaintFill))
        }
        .fixedSize()
        .task { await pillars.loadIfNeeded() }
    }
}

/// Every format as a toggle, so the whole set is visible and one click away.
struct IdeaCanvasFormatToggles: View {
    let formats: [String]
    let onChange: ([String]) -> Void

    var body: some View {
        IdeaCanvasFlowLayout(spacing: 6) {
            ForEach(IdeaCanvasFormat.all) { format in
                let on = formats.contains(format.id)
                Button { onChange(IdeaCanvasFormat.toggle(format.id, in: formats)) } label: {
                    Text(format.label)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(on ? (format.tone == .neutral ? Color.primary : format.tone.color) : Color.secondary)
                        .padding(.horizontal, 12)
                        .frame(height: 28)
                        .background(Capsule().fill(on ? format.tone.color.opacity(0.16) : Color.studioFaintFill))
                }
                .buttonStyle(.studioPlain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}

/// The plan date, shown once the piece is ready.
struct IdeaCanvasScheduleField: View {
    let scheduledFor: String?
    let onChange: (String) -> Void

    var body: some View {
        if let date = IdeaCanvasDates.parse(scheduledFor) {
            DatePicker("", selection: Binding(get: { date }, set: { onChange(IdeaCanvasDates.format($0)) }))
                .labelsHidden()
                .datePickerStyle(.compact)
                .fixedSize()
        } else {
            Button("Pick a date") { onChange(IdeaCanvasDates.format(IdeaCanvasDates.tomorrowMorning())) }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        }
    }
}

enum IdeaCanvasDates {
    static func parse(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    static func format(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    static func tomorrowMorning() -> Date {
        let calendar = Calendar.current
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        return calendar.date(bySettingHour: 9, minute: 0, second: 0, of: tomorrow) ?? tomorrow
    }
}
