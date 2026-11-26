import SwiftUI

/// Simple mode's left side: a slim rail of four panes and the one that is
/// open. The panes are the same views Pro shows, so nothing here is a
/// second copy of a feature.
struct SimpleWorkbench: View {
    @ObservedObject var session: EditorSession
    @State private var item: SimpleRailItem = .quick

    var body: some View {
        HStack(spacing: 0) {
            SimpleRail(session: session, selection: $item)
            Rectangle().fill(Color.studioLine).frame(width: 1)
            pane
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.panelBackground)
        .onChange(of: session.inspectorRequest) { _, request in
            guard let request, let tab = WorkbenchTab(rawValue: request.tool), let next = SimpleRailItem(tab: tab) else { return }
            withAnimation(.easeOut(duration: 0.14)) { item = next }
        }
        .onChange(of: session.project.clips.isEmpty) { wasEmpty, isEmpty in
            // Footage just arrived: 1-Click Edit is the next thing to do.
            if wasEmpty, !isEmpty { item = .quick }
        }
        .overlay {
            if let stage = session.oneClickEditStage {
                OneClickEditProgressOverlay(stage: stage, pace: session.oneClickEditPace)
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.16), value: session.oneClickEditStage)
    }

    @ViewBuilder
    private var pane: some View {
        switch item {
        case .quick:
            SimpleEditPane(session: session)
        case .captions:
            CaptionWorkbenchView(session: session)
        case .text:
            TextWorkbench(session: session)
        case .sounds:
            AudioWorkbench(session: session)
        }
    }
}

/// The panes, as icons with short labels.
private struct SimpleRail: View {
    @ObservedObject var session: EditorSession
    @Binding var selection: SimpleRailItem

    var body: some View {
        VStack(spacing: 4) {
            ForEach(SimpleRailItem.allCases) { item in
                Button {
                    withAnimation(.easeOut(duration: 0.14)) { selection = item }
                } label: {
                    VStack(spacing: 4) {
                        StudioGlyph(item.glyph, size: 17)
                        Text(item.title).font(.system(size: 10, weight: .medium)).lineLimit(1)
                    }
                    .frame(width: 58, height: 52)
                    .foregroundStyle(selection == item ? Color.primary : Color.studioTextMuted)
                    .background(selection == item ? Color.studioSelectedFill : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                    // A tick once that part of the video is done, so the rail
                    // itself says how far along the edit is.
                    .overlay(alignment: .topTrailing) {
                        if item.isDone(in: session) {
                            StudioGlyph(.check, size: 8)
                                .foregroundStyle(Color.studioSuccess)
                                .frame(width: 14, height: 14)
                                .background(Circle().fill(Color.sidebarBackground))
                                .offset(x: -5, y: 5)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(item.purpose)
                .accessibilityLabel(item.title)
                .accessibilityValue(item.isDone(in: session) ? "Done" : "")
                .accessibilityAddTraits(selection == item ? .isSelected : [])
            }
            Spacer(minLength: 0)
            // Always one click away: a second take, a picture for a hook, a
            // sound. Dropping a file on the timeline works too.
            Button {
                ImportPanels.openMedia(for: session)
            } label: {
                VStack(spacing: 4) {
                    StudioGlyph(.plus, size: 17)
                    Text("Import").font(.system(size: 10, weight: .medium))
                }
                .frame(width: 58, height: 52)
                .foregroundStyle(Color.primary)
                .background(Color.studioFaintFill)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(session.isBusy)
            .help("Add video, pictures or sound to this project")
            .accessibilityLabel("Import media")
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 6)
        .frame(width: 70)
        .background(Color.sidebarBackground)
    }
}
