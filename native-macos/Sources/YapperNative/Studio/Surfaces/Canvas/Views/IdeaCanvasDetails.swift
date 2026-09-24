import SwiftUI

/// The facts about the piece that are not its words: its pillar and the plan
/// date once it is ready. What it ships as is the version tabs above.
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
            // The pillar's own hue, as on the Ideas list, so it is the same
            // chip everywhere.
            let tone = linked.map { IdeaPillarTone.tone(for: $0.name).color }
            HStack(spacing: 6) {
                if let tone { Circle().fill(tone).frame(width: 6, height: 6) }
                Text(linked?.name ?? none).lineLimit(1)
                Image(systemName: "chevron.down").font(.system(size: 11)).foregroundStyle(.secondary)
            }
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 12)
            .frame(height: 28)
            .frame(maxWidth: 220)
            .background(Capsule().fill(tone?.opacity(0.16) ?? Color.studioFaintFill))
        }
        .fixedSize()
        .task { await pillars.loadIfNeeded() }
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
