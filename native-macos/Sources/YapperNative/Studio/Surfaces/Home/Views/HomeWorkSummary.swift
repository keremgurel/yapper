import SwiftUI

struct HomeWorkSummary: View {
    let items: [IdeaItem]?
    let ideasFailed: Bool
    let saved: HomeTimeSaved?
    let savedFailed: Bool
    let now: Date
    private var ideas: [IdeaItem]? { items?.filter { $0.status != "posted" } }
    private var planned: [IdeaItem]? {
        ideas?.filter { item in
            guard let raw = item.scheduledFor, let date = IdeaDates.parse(raw) else { return false }
            return date >= Calendar.current.startOfDay(for: now)
        }.sorted { ($0.scheduledFor ?? "") < ($1.scheduledFor ?? "") }
    }
    var body: some View {
        HStack(alignment: .top, spacing: 28) {
            section("Ideas", link: "See all ideas", destination: .ideas) {
                number(ideas.map { String($0.count) }, label: "in progress")
                if ideasFailed { caption("Ideas couldn’t be loaded.") }
                else if let ideas {
                    if ideas.isEmpty { caption("Capture a thought above to start your next video.") }
                    ForEach(Array(ideas.sorted { $0.updatedAt > $1.updatedAt }.prefix(2))) { item in
                        caption(item.displayTitle).lineLimit(1).help(item.displayTitle)
                    }
                } else { caption("Loading ideas…") }
            }
            section("Yapper Edit", link: "Open editor", destination: .editor) {
                number(saved.map { (Double($0.savedSeconds) / 3600).formatted(.number.precision(.fractionLength(0...1))) }, label: "hours saved")
                if savedFailed { caption("Edit history couldn’t be loaded.") }
                else if let saved { caption("\(saved.edits.formatted()) videos edited · \(saved.cutCount.formatted()) cuts made") }
                else { caption("Loading edit history…") }
                DisclosureGroup("How we estimate time saved") {
                    caption("One watch of your footage plus about 20 seconds per cut. Counted across your Yapper edits.").padding(.top, 4)
                }.font(.system(size: 12)).foregroundStyle(.secondary)
            }
            section("Calendar", link: "See calendar", destination: .calendar) {
                number(planned.map { String($0.count) }, label: "videos planned")
                if ideasFailed { caption("Calendar items couldn’t be loaded.") }
                else if let planned {
                    if planned.isEmpty { caption("No upcoming plans. Give your next idea a date.") }
                    ForEach(Array(planned.prefix(2))) { item in
                        HStack(spacing: 12) {
                            if let raw = item.scheduledFor, let date = IdeaDates.parse(raw) {
                                caption(date.formatted(.dateTime.month(.abbreviated).day())).fixedSize()
                            }
                            Text(item.displayTitle).font(.system(size: 12)).lineLimit(1).help(item.displayTitle)
                        }
                    }
                } else { caption("Loading calendar…") }
            }
        }
    }
    private func caption(_ text: String) -> some View {
        Text(text).font(.system(size: 12)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
    }
    private func number(_ value: String?, label: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(value ?? "—").font(.system(size: 26, weight: .semibold)).monospacedDigit()
            caption(label)
        }.padding(.vertical, 8)
    }
    private func section<Content: View>(_ title: String, link: String, destination: StudioDestination, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider().padding(.bottom, 8)
            HStack {
                Text(title).font(.system(size: 14, weight: .semibold))
                Spacer(minLength: 4)
                Button(link) { StudioNavigation.shared.goTo(destination) }.buttonStyle(.studioPlain).font(.system(size: 12)).foregroundStyle(.secondary)
            }
            content()
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}
