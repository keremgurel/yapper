import SwiftUI
struct HomeQuickTools: View {
    let ideaCount: Int?
    private struct Tool: Identifiable {
        let title: String
        let description: String
        let icon: String
        let destination: StudioDestination
        var id: String { title }
    }
    private var tools: [Tool] { [
        Tool(title: "Ideas", description: ideaCount.map { "\($0) \($0 == 1 ? "idea" : "ideas") in progress" } ?? "Capture and shape your next idea", icon: "lightbulb", destination: .ideas),
        Tool(title: "Recorder", description: "Get your next take on camera", icon: "video", destination: .recorder),
        Tool(title: "Editor", description: "Turn a take into a finished video", icon: "scissors", destination: .editor),
        Tool(title: "Poster", description: "Prepare and share across channels", icon: "paperplane", destination: .poster)
    ] }
    var body: some View {
        NativeSection(title: "Make your next video") { EmptyView() } content: {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(minimum: 100), spacing: 12), count: 4), spacing: 12) {
                ForEach(tools) { tool in
                    Button { StudioNavigation.shared.goTo(tool.destination) } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: tool.icon).frame(width: 16).foregroundStyle(.secondary)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(tool.title).font(.system(size: 14, weight: .semibold))
                                Text(tool.description).font(.system(size: 12)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                            }.frame(maxWidth: .infinity, alignment: .leading)
                            Image(systemName: "arrow.up.right").foregroundStyle(.secondary)
                        }.padding(16).frame(maxWidth: .infinity, minHeight: 84, alignment: .topLeading).background(NativeCardBackground(radius: 12))
                    }.buttonStyle(.studioPlain)
                }
            }
        }
    }
}
