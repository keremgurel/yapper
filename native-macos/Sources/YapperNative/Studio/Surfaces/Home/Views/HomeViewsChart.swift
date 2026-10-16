import SwiftUI
import Charts

struct HomeViewsChart: View {
    let performance: HomeRecentPerformance?
    @State private var platform: PublishPlatform?
    @State private var selectedDate: Date?

    private var channels: [PublishPlatform] { performance?.channels.map(\.platform) ?? [] }
    private var selected: PublishPlatform? { platform.flatMap { channels.contains($0) ? $0 : nil } }
    private var chartCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }
    private func dateLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.setLocalizedDateFormatFromTemplate("MMMd")
        return formatter.string(from: date)
    }
    private var inspectedGroups: [HomeVideoGroup] {
        day?.groups.filter { selected == nil || $0.posts.contains { $0.platform == selected } } ?? []
    }
    private var day: HomeRecentPerformance.Day? {
        guard let selectedDate else { return nil }
        return performance?.days.first { chartCalendar.isDate($0.date, inSameDayAs: selectedDate) }
    }
    private func views(_ day: HomeRecentPerformance.Day, _ platform: PublishPlatform) -> Int {
        day.groups.flatMap(\.posts).filter { $0.platform == platform }.reduce(0) { $0 + $1.video.viewCount }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                NativeSegmented(options: [.init(value: Optional<PublishPlatform>.none, label: "All platforms")] + channels.map { .init(value: Optional($0), label: $0.label) }, selection: $platform)
                Spacer(minLength: 8)
                Text("Published in the last 30 days").font(.system(size: 12)).foregroundStyle(.secondary)
            }
            if let performance {
                if performance.groups.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Your next video starts the chart").font(.system(size: 13, weight: .medium))
                        Text("No videos were found in the last 30 days.").font(.system(size: 12)).foregroundStyle(.secondary)
                    }.frame(height: 160)
                } else {
                    Chart {
                        ForEach(performance.days) { day in
                            ForEach(channels.filter { selected == nil || $0 == selected }, id: \.self) { key in
                                BarMark(x: .value("Publish date", day.date, unit: .day), y: .value("Current views", views(day, key)))
                                    .foregroundStyle(HomeChartColor.color(key))
                                    .accessibilityLabel("\(key.label), videos published \(dateLabel(day.date))")
                                    .accessibilityValue("\(views(day, key)) views")
                            }
                        }
                    }
                    .chartYAxis { AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) }
                    .chartXAxis { AxisMarks(values: .automatic(desiredCount: 5)) }
                    .environment(\.calendar, chartCalendar)
                    .environment(\.timeZone, TimeZone(secondsFromGMT: 0)!)
                    .chartXSelection(value: $selectedDate)
                    .chartOverlay { proxy in
                        GeometryReader { geometry in
                            Color.clear.onContinuousHover { phase in
                                switch phase {
                                case .active(let point):
                                    if let frame = proxy.plotFrame { selectedDate = proxy.value(atX: point.x - geometry[frame].origin.x) }
                                case .ended: selectedDate = nil
                                }
                            }
                        }
                    }
                    .frame(height: 180)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(day.map { "\(dateLabel($0.date)) · \(inspectedGroups.count) videos · \($0.groups.flatMap(\.posts).filter { selected == nil || $0.platform == selected }.reduce(0) { $0 + $1.video.viewCount }.formatted()) views" } ?? "Views by publish date")
                            .font(.system(size: 12, weight: .medium))
                        Text(day.map { _ in inspectedGroups.isEmpty ? "No videos posted on this date" : inspectedGroups.map { $0.primary.video.displayTitle }.joined(separator: " · ") } ?? "Current view counts, with cross-posts combined into one video.")
                            .font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
                    }.frame(height: 36, alignment: .topLeading)
                }
            } else { NativeLoadingState(label: "Loading video views…").frame(height: 160) }
        }
    }
}

enum HomeChartColor {
    static func color(_ platform: PublishPlatform) -> Color {
        let light: UInt32
        let dark: UInt32
        switch platform {
        case .youtube: (light, dark) = (0xD92E26, 0xFF4E45)
        case .instagram: (light, dark) = (0xB43278, 0xF06CAE)
        case .tiktok: (light, dark) = (0x087F7A, 0x42E8E0)
        case .facebook: (light, dark) = (0x1664D8, 0x6AA8FF)
        }
        return Color(nsColor: NSColor(name: nil) { appearance in
            NSColor(hex: appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light)
        })
    }
}
