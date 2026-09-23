import SwiftUI

/// One scheduled item on the calendar: a status dot, its time, a mark if it
/// has a recording, and its title. Click opens the idea; drag it to another
/// day to reschedule.
struct CalendarPostChip: View {
    let item: CalendarItem
    let onOpen: () -> Void

    @State private var hovering = false

    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(item.status.tone.color).frame(width: 6, height: 6)
            if let date = item.scheduledDate {
                Text(date.formatted(date: .omitted, time: .shortened))
                    .font(.system(size: 11, weight: .medium).monospacedDigit())
                    .foregroundStyle(.secondary)
                    .fixedSize()
            }
            if item.submissionId != nil {
                Image(systemName: "video")
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }
            Text(item.displayTitle)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(hovering ? Color.studioSelectedFill : Color.raisedBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .strokeBorder(Color.studioLine, lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onHover { hovering = $0 }
        .onTapGesture(perform: onOpen)
        .draggable(item.id) {
            Text(item.displayTitle)
                .font(.system(size: 11, weight: .medium))
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(RoundedRectangle(cornerRadius: 6).fill(Color.raisedBackground))
        }
        .clickableCursor()
        .help(item.displayTitle)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(named: "Open", onOpen)
    }
}
