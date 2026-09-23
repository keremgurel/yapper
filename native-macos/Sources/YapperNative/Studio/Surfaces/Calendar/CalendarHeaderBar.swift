import SwiftUI

/// Calendar chrome: previous and next, the period, Today, and the Month and
/// Week switch.
struct CalendarHeaderBar: View {
    @Binding var navigator: CalendarNavigator
    let dates: CalendarDates

    var body: some View {
        HStack(spacing: 8) {
            Button { navigator.step(-1, dates: dates) } label: {
                Image(systemName: "chevron.left")
            }
            .buttonStyle(EditorGhostButtonStyle(size: .small))
            .help("Previous")
            .accessibilityLabel("Previous")
            Button { navigator.step(1, dates: dates) } label: {
                Image(systemName: "chevron.right")
            }
            .buttonStyle(EditorGhostButtonStyle(size: .small))
            .help("Next")
            .accessibilityLabel("Next")
            Text(navigator.label(dates))
                .font(.system(size: 17, weight: .semibold))
                .frame(minWidth: 180, alignment: .leading)
            Button("Today") { navigator.today() }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            Spacer(minLength: 12)
            Picker("View", selection: $navigator.mode) {
                ForEach(CalendarViewMode.allCases) { mode in
                    Text(mode.label).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .fixedSize()
            .clickableCursor()
        }
        .padding(.bottom, 16)
    }
}
