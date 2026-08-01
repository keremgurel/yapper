import SwiftUI

struct StudioPageView: View {
    let destination: StudioDestination
    @ObservedObject var session: EditorSession
    let onNavigate: (StudioDestination) -> Void

    var body: some View {
        ScrollView {
            Group {
                switch destination {
                case .home:
                    HomePage(session: session, onNavigate: onNavigate)
                case .ideas:
                    IdeaBankPage(onNavigate: onNavigate)
                case .library:
                    ContentLibraryPage(session: session, onNavigate: onNavigate)
                case .recorder:
                    RecorderPage(onNavigate: onNavigate)
                case .poster:
                    PosterPage(session: session, onNavigate: onNavigate)
                case .calendar:
                    CalendarPage(onNavigate: onNavigate)
                case .automations:
                    AutomationsPage(onNavigate: onNavigate)
                case .dictionary:
                    DictionaryPage()
                case .connections:
                    ConnectionsPage()
                case .editor:
                    EmptyView()
                }
            }
            .frame(maxWidth: 1_160)
            .padding(.horizontal, 28)
            .padding(.vertical, 28)
            .frame(maxWidth: .infinity)
        }
        .background(Color.editorBackground)
    }
}

private struct HomePage: View {
    @ObservedObject var session: EditorSession
    let onNavigate: (StudioDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            PageHeader(
                eyebrow: "Home",
                title: "Your content, in one view.",
                detail: "Performance across every connected channel, the posts doing the most work, and five ideas ready for today."
            ) {
                Button("Idea bank") { onNavigate(.ideas) }
                    .buttonStyle(EditorSecondaryButtonStyle())
                Button("New video") { onNavigate(.editor) }
                    .buttonStyle(EditorPrimaryButtonStyle())
            }

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 4),
                spacing: 0
            ) {
                MetricCell(label: "Total views", value: "—", detail: "Connected channels")
                MetricCell(label: "Published", value: "—", detail: "All platforms")
                MetricCell(
                    label: "Open project",
                    value: session.project.clips.isEmpty ? "None" : "1",
                    detail: session.project.name
                )
                MetricCell(
                    label: "Timeline",
                    value: formatTime(session.duration),
                    detail: "\(session.project.clips.count) clips"
                )
            }
            .background(Color.raisedBackground.opacity(0.72))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(StudioBorder(radius: 10))

            StudioCard(title: "Connected channels", detail: "One publishing identity across every platform.") {
                LazyVGrid(columns: [.init(.flexible()), .init(.flexible()), .init(.flexible())], spacing: 10) {
                    ChannelSummary(name: "YouTube", symbol: "play.rectangle", color: .red)
                    ChannelSummary(name: "TikTok", symbol: "music.note", color: .white)
                    ChannelSummary(name: "Instagram", symbol: "camera", color: .pink)
                }
            }

            HStack(alignment: .top, spacing: 14) {
                StudioCard(title: "Top content", detail: "Your strongest posts across every channel.") {
                    HStack(spacing: 10) {
                        ForEach(1 ... 3, id: \.self) { rank in
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.white.opacity(0.035))
                                .aspectRatio(0.9, contentMode: .fit)
                                .overlay {
                                    VStack(spacing: 8) {
                                        Text("#\(rank)")
                                            .font(.system(size: 10, weight: .black, design: .monospaced))
                                            .foregroundStyle(Color.yapperOrange)
                                        Image(systemName: "chart.bar")
                                            .font(.system(size: 21, weight: .light))
                                            .foregroundStyle(.secondary)
                                        Text("Connect channels to rank content")
                                            .font(.system(size: 9, weight: .medium))
                                            .multilineTextAlignment(.center)
                                            .foregroundStyle(.secondary)
                                            .padding(.horizontal, 8)
                                    }
                                }
                        }
                    }
                }
                .frame(maxWidth: .infinity)

                StudioCard(title: "Five for today", detail: "Start with one, then shape it in Idea Bank.") {
                    VStack(spacing: 0) {
                        ForEach(Array(dailyIdeas.enumerated()), id: \.offset) { index, idea in
                            Button { onNavigate(.ideas) } label: {
                                HStack(alignment: .top, spacing: 10) {
                                    Text(String(format: "%02d", index + 1))
                                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                                        .foregroundStyle(Color.yapperOrange)
                                    Text(idea)
                                        .font(.system(size: 10, weight: .medium))
                                        .lineLimit(2)
                                    Spacer()
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 8)
                            }
                            .buttonStyle(.plain)
                            if index < dailyIdeas.count - 1 {
                                Rectangle().fill(Color.white.opacity(0.06)).frame(height: 1)
                            }
                        }
                    }
                }
                .frame(width: 330)
            }
        }
    }

    private var dailyIdeas: [String] {
        [
            "Fix one mistake your audience keeps repeating",
            "Show the fastest useful result in thirty seconds",
            "React to advice in your niche that sounds right but is not",
            "Turn a student win into a three-step lesson",
            "Explain what you would do differently starting today",
        ]
    }
}

private struct IdeaBankPage: View {
    @AppStorage("nativeIdeaDraft") private var draft = ""
    let onNavigate: (StudioDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            PageHeader(
                eyebrow: "Lab",
                title: "Idea bank",
                detail: "Drop a link, a voice note, or the rough thought exactly as it came to you."
            ) {
                Button("Content Library") { onNavigate(.library) }
                    .buttonStyle(EditorSecondaryButtonStyle())
            }

            StudioCard(title: "Capture something", detail: "Your source stays attached when the idea expands.") {
                VStack(alignment: .leading, spacing: 12) {
                    TextEditor(text: $draft)
                        .font(.system(size: 12))
                        .scrollContentBackground(.hidden)
                        .padding(10)
                        .frame(minHeight: 96)
                        .background(Color.black.opacity(0.22))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(StudioBorder(radius: 8))
                    HStack {
                        Label("Link, note, or both", systemImage: "link")
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button("Voice") {}
                            .buttonStyle(EditorSecondaryButtonStyle())
                        Button("Add idea") {}
                            .buttonStyle(EditorPrimaryButtonStyle())
                            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }

            StudioCard(title: "Ideas in progress", detail: "Adaptable briefs—not a forced one-size-fits-all template.") {
                VStack(spacing: 10) {
                    IdeaRow(title: "CELPIP listening be like", kind: "Humor", source: "Instagram reference")
                    IdeaRow(title: "The mistake keeping your score below nine", kind: "Education", source: "Original")
                    IdeaRow(title: "Practice test reaction", kind: "Reaction", source: "Voice note")
                }
            }
        }
    }
}

private struct ContentLibraryPage: View {
    @ObservedObject var session: EditorSession
    let onNavigate: (StudioDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            PageHeader(
                eyebrow: "Lab",
                title: "Content Library",
                detail: "The database of ideas you chose to make—organized from draft through published."
            ) {
                Button("Open Idea bank") { onNavigate(.ideas) }
                    .buttonStyle(EditorSecondaryButtonStyle())
            }

            HStack(spacing: 8) {
                FilterPill(title: "All", count: 4, selected: true)
                FilterPill(title: "Draft", count: 2)
                FilterPill(title: "Ready to record", count: 1)
                FilterPill(title: "Editing", count: session.project.clips.isEmpty ? 0 : 1)
                FilterPill(title: "Posted", count: 0)
            }

            StudioCard(title: "Your pipeline", detail: "Every item keeps its source, script, takes, and final edit together.") {
                VStack(spacing: 8) {
                    if !session.project.clips.isEmpty {
                        LibraryRow(
                            title: session.project.name,
                            state: "Editing",
                            action: "Continue edit",
                            onAction: { onNavigate(.editor) }
                        )
                    }
                    LibraryRow(
                        title: "CELPIP listening be like",
                        state: "Ready to record",
                        action: "Record",
                        onAction: { onNavigate(.recorder) }
                    )
                    LibraryRow(
                        title: "Five ways to practice every day",
                        state: "Draft",
                        action: "Open",
                        onAction: {}
                    )
                }
            }
        }
    }
}

private struct RecorderPage: View {
    let onNavigate: (StudioDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            PageHeader(
                eyebrow: "Studio",
                title: "Recorder",
                detail: "A clean native camera stage with the script where your eyes already are."
            ) {
                Button("Edit last take") { onNavigate(.editor) }
                    .buttonStyle(EditorSecondaryButtonStyle())
            }

            HStack(alignment: .top, spacing: 14) {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.black)
                    .aspectRatio(16 / 10, contentMode: .fit)
                    .overlay {
                        VStack(spacing: 12) {
                            Image(systemName: "video")
                                .font(.system(size: 34, weight: .light))
                                .foregroundStyle(.secondary)
                            Text("Camera preview")
                                .font(.system(size: 13, weight: .bold))
                            Button("Enable camera") {}
                                .buttonStyle(EditorPrimaryButtonStyle())
                        }
                    }
                    .overlay(StudioBorder(radius: 10))
                    .frame(maxWidth: .infinity)

                StudioCard(title: "Teleprompter", detail: "Select an item from Content Library or paste a script.") {
                    Text("Your script appears here at a comfortable reading width. Recording controls stay visible without covering your words.")
                        .font(.system(size: 15, weight: .medium))
                        .lineSpacing(7)
                        .foregroundStyle(Color.white.opacity(0.8))
                        .padding(.vertical, 10)
                    Spacer(minLength: 60)
                    HStack {
                        Button("Choose script") { onNavigate(.library) }
                            .buttonStyle(EditorSecondaryButtonStyle())
                        Spacer()
                        Button("Record") {}
                            .buttonStyle(EditorPrimaryButtonStyle())
                    }
                }
                .frame(width: 340)
            }
        }
    }
}

private struct PosterPage: View {
    @ObservedObject var session: EditorSession
    let onNavigate: (StudioDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            PageHeader(
                eyebrow: "Press",
                title: "Plan the post, then choose where it goes.",
                detail: "Select one or many videos, generate the post, and publish to several destinations at once."
            ) {
                Button("Open calendar") { onNavigate(.calendar) }
                    .buttonStyle(EditorSecondaryButtonStyle())
                Button("Add videos") { onNavigate(.editor) }
                    .buttonStyle(EditorPrimaryButtonStyle())
            }

            StudioCard(title: "Selected videos", detail: "Final edits from Yapper stay reusable without downloading them again.") {
                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.black)
                        .frame(width: 118, height: 148)
                        .overlay {
                            VStack(spacing: 8) {
                                Image(systemName: session.project.clips.isEmpty ? "plus" : "film")
                                Text(session.project.clips.isEmpty ? "Choose a video" : session.project.name)
                                    .font(.system(size: 9, weight: .semibold))
                                    .lineLimit(2)
                                    .multilineTextAlignment(.center)
                            }
                            .foregroundStyle(.secondary)
                            .padding(8)
                        }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Post copy")
                            .font(.system(size: 11, weight: .bold))
                        Text("Generate a caption for each platform, then adjust any one without changing the others.")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                        HStack(spacing: 7) {
                            PlatformToggle(title: "YouTube", symbol: "play.rectangle")
                            PlatformToggle(title: "TikTok", symbol: "music.note")
                            PlatformToggle(title: "Instagram", symbol: "camera")
                        }
                    }
                    Spacer()
                }
            }
        }
    }
}

private struct CalendarPage: View {
    let onNavigate: (StudioDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            PageHeader(
                eyebrow: "Press",
                title: "Calendar",
                detail: "See every scheduled post without losing the edit you were working on."
            ) {
                Button("Create post") { onNavigate(.poster) }
                    .buttonStyle(EditorPrimaryButtonStyle())
            }
            StudioCard(title: "This week", detail: "August 1–7") {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 7), spacing: 6) {
                    ForEach(Array(["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"].enumerated()), id: \.offset) { index, day in
                        VStack(alignment: .leading, spacing: 9) {
                            Text(day.uppercased())
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundStyle(.secondary)
                            Text("\(index + 1)")
                                .font(.system(size: 17, weight: .bold))
                            if index == 2 || index == 5 {
                                RoundedRectangle(cornerRadius: 5)
                                    .fill(Color.yapperOrange.opacity(0.17))
                                    .frame(height: 48)
                                    .overlay(alignment: .leading) {
                                        Text(index == 2 ? "Practice tip" : "Mock exam")
                                            .font(.system(size: 9, weight: .semibold))
                                            .padding(7)
                                    }
                            }
                            Spacer()
                        }
                        .padding(9)
                        .frame(minHeight: 150, alignment: .topLeading)
                        .background(Color.black.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 7))
                        .overlay(StudioBorder(radius: 7))
                    }
                }
            }
        }
    }
}

private struct AutomationsPage: View {
    let onNavigate: (StudioDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            PageHeader(
                eyebrow: "Press",
                title: "Automations",
                detail: "Publish once, then let a clear rule handle the repeat work."
            ) {
                Button("New automation") {}
                    .buttonStyle(EditorPrimaryButtonStyle())
            }
            StudioCard(title: "Publishing rules", detail: "Nothing posts somewhere you did not explicitly select.") {
                VStack(spacing: 8) {
                    AutomationRow(title: "Instagram Reel → TikTok", detail: "Copy caption · preserve public visibility")
                    AutomationRow(title: "Finished Yapper edit → Content Library", detail: "Save original and exported version")
                    AutomationRow(title: "Scheduled post → Calendar", detail: "Create a visible calendar entry")
                }
            }
        }
    }
}

private struct DictionaryPage: View {
    @AppStorage("nativeDictionaryDraft") private var draft = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            PageHeader(
                eyebrow: "Settings",
                title: "Dictionary",
                detail: "Teach transcription the names, products, and vocabulary you use repeatedly."
            ) {
                EmptyView()
            }
            StudioCard(title: "Add a term", detail: "Aliases help Yapper correct what the model thought it heard.") {
                HStack {
                    TextField("e.g. CELPIP", text: $draft)
                        .textFieldStyle(.plain)
                        .padding(.horizontal, 11)
                        .frame(height: 34)
                        .background(Color.black.opacity(0.22))
                        .clipShape(RoundedRectangle(cornerRadius: 7))
                        .overlay(StudioBorder(radius: 7))
                    Button("Add term") {}
                        .buttonStyle(EditorPrimaryButtonStyle())
                        .disabled(draft.isEmpty)
                }
                VStack(spacing: 0) {
                    DictionaryRow(term: "CELPIP", aliases: "cell pip, sell pip")
                    DictionaryRow(term: "Southwip", aliases: "South Whip")
                    DictionaryRow(term: "Yapper", aliases: "yapper studio")
                }
                .padding(.top, 10)
            }
        }
    }
}

private struct ConnectionsPage: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            PageHeader(
                eyebrow: "Settings",
                title: "Connections",
                detail: "Connect an account once. Posting, scheduling, and channel analytics use the same connection."
            ) {
                EmptyView()
            }
            LazyVGrid(columns: [.init(.flexible()), .init(.flexible()), .init(.flexible())], spacing: 12) {
                ConnectionCard(name: "YouTube", symbol: "play.rectangle", color: .red)
                ConnectionCard(name: "TikTok", symbol: "music.note", color: .white)
                ConnectionCard(name: "Instagram", symbol: "camera", color: .pink)
            }
        }
    }
}

private struct PageHeader<Actions: View>: View {
    let eyebrow: String
    let title: String
    let detail: String
    @ViewBuilder let actions: Actions

    init(
        eyebrow: String,
        title: String,
        detail: String,
        @ViewBuilder actions: () -> Actions
    ) {
        self.eyebrow = eyebrow
        self.title = title
        self.detail = detail
        self.actions = actions()
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 18) {
            VStack(alignment: .leading, spacing: 7) {
                Text(eyebrow.uppercased())
                    .font(.system(size: 9, weight: .black, design: .monospaced))
                    .tracking(1.25)
                    .foregroundStyle(Color.yapperOrange)
                Text(title)
                    .font(.system(size: 29, weight: .black, design: .rounded))
                    .tracking(-0.7)
                Text(detail)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .lineSpacing(3)
                    .frame(maxWidth: 650, alignment: .leading)
            }
            Spacer()
            HStack(spacing: 8) { actions }
        }
    }
}

private struct StudioCard<Content: View>: View {
    let title: String
    let detail: String
    @ViewBuilder let content: Content

    init(title: String, detail: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.detail = detail
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 13, weight: .bold))
                Text(detail).font(.system(size: 10)).foregroundStyle(.secondary)
            }
            content
        }
        .padding(16)
        .background(Color.raisedBackground.opacity(0.58))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(StudioBorder(radius: 10))
    }
}

private struct StudioBorder: View {
    let radius: CGFloat
    var body: some View {
        RoundedRectangle(cornerRadius: radius)
            .stroke(Color.white.opacity(0.085), lineWidth: 1)
    }
}

private struct MetricCell: View {
    let label: String
    let value: String
    let detail: String
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .tracking(0.7)
                .foregroundStyle(.secondary)
            Text(value).font(.system(size: 22, weight: .black, design: .rounded))
            Text(detail).font(.system(size: 9)).foregroundStyle(.secondary).lineLimit(1)
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .trailing) {
            Rectangle().fill(Color.white.opacity(0.065)).frame(width: 1)
        }
    }
}

private struct ChannelSummary: View {
    let name: String
    let symbol: String
    let color: Color
    var body: some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 7)
                .fill(Color.black.opacity(0.22))
                .overlay(Image(systemName: symbol).foregroundStyle(color))
                .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 11, weight: .bold))
                Text("Connect account").font(.system(size: 9)).foregroundStyle(.secondary)
            }
            Spacer()
            Circle().fill(Color.white.opacity(0.15)).frame(width: 6, height: 6)
        }
        .padding(11)
        .background(Color.black.opacity(0.14))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(StudioBorder(radius: 8))
    }
}

private struct IdeaRow: View {
    let title: String
    let kind: String
    let source: String
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "lightbulb")
                .foregroundStyle(Color.yapperOrange)
                .frame(width: 32, height: 32)
                .background(Color.yapperOrange.opacity(0.09))
                .clipShape(RoundedRectangle(cornerRadius: 7))
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 11, weight: .bold))
                Text("\(kind) · \(source)").font(.system(size: 9)).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)
        }
        .padding(11)
        .background(Color.black.opacity(0.13))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(StudioBorder(radius: 8))
    }
}

private struct FilterPill: View {
    let title: String
    let count: Int
    var selected = false
    var body: some View {
        HStack(spacing: 7) {
            Text(title)
            Text("\(count)").foregroundStyle(.secondary)
        }
        .font(.system(size: 10, weight: .semibold))
        .padding(.horizontal, 10)
        .frame(height: 30)
        .background(selected ? Color.yapperOrange.opacity(0.16) : Color.white.opacity(0.04))
        .foregroundStyle(selected ? Color.yapperOrange : Color.white.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(StudioBorder(radius: 7))
    }
}

private struct LibraryRow: View {
    let title: String
    let state: String
    let action: String
    let onAction: () -> Void
    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.black.opacity(0.35))
                .overlay(Image(systemName: "doc.richtext").foregroundStyle(.secondary))
                .frame(width: 52, height: 42)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 11, weight: .bold))
                Text(state).font(.system(size: 9, weight: .semibold)).foregroundStyle(Color.yapperOrange)
            }
            Spacer()
            Button(action, action: onAction).buttonStyle(EditorSecondaryButtonStyle())
        }
        .padding(10)
        .background(Color.black.opacity(0.13))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(StudioBorder(radius: 8))
    }
}

private struct PlatformToggle: View {
    let title: String
    let symbol: String
    @State private var selected = false
    var body: some View {
        Button { selected.toggle() } label: {
            HStack(spacing: 6) {
                Image(systemName: symbol)
                Text(title)
            }
            .font(.system(size: 10, weight: .semibold))
            .padding(.horizontal, 9)
            .frame(height: 30)
            .background(selected ? Color.yapperOrange.opacity(0.15) : Color.white.opacity(0.045))
            .foregroundStyle(selected ? Color.yapperOrange : Color.white.opacity(0.68))
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .overlay(StudioBorder(radius: 7))
        }
        .buttonStyle(.plain)
    }
}

private struct AutomationRow: View {
    let title: String
    let detail: String
    @State private var enabled = false
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "bolt")
                .foregroundStyle(Color.yapperOrange)
                .frame(width: 32, height: 32)
                .background(Color.yapperOrange.opacity(0.09))
                .clipShape(RoundedRectangle(cornerRadius: 7))
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 11, weight: .bold))
                Text(detail).font(.system(size: 9)).foregroundStyle(.secondary)
            }
            Spacer()
            Toggle("", isOn: $enabled).labelsHidden().toggleStyle(.switch).controlSize(.small)
        }
        .padding(11)
        .background(Color.black.opacity(0.13))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(StudioBorder(radius: 8))
    }
}

private struct DictionaryRow: View {
    let term: String
    let aliases: String
    var body: some View {
        HStack {
            Text(term).font(.system(size: 11, weight: .bold)).frame(width: 140, alignment: .leading)
            Text(aliases).font(.system(size: 10)).foregroundStyle(.secondary)
            Spacer()
            Button("Edit") {}.buttonStyle(.plain).font(.system(size: 9, weight: .semibold)).foregroundStyle(Color.yapperOrange)
        }
        .padding(.vertical, 10)
        .overlay(alignment: .bottom) { Rectangle().fill(Color.white.opacity(0.06)).frame(height: 1) }
    }
}

private struct ConnectionCard: View {
    let name: String
    let symbol: String
    let color: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.black.opacity(0.25))
                    .overlay(Image(systemName: symbol).foregroundStyle(color))
                    .frame(width: 42, height: 42)
                Spacer()
                Text("Not connected")
                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
            Text(name).font(.system(size: 14, weight: .bold))
            Text("Connect once to publish, schedule, and load analytics.")
                .font(.system(size: 10)).foregroundStyle(.secondary).lineSpacing(2)
            Button("Connect") {}.buttonStyle(EditorSecondaryButtonStyle())
        }
        .padding(16)
        .background(Color.raisedBackground.opacity(0.58))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(StudioBorder(radius: 10))
    }
}
