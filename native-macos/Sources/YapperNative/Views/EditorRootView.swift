import SwiftUI

struct EditorRootView: View {
    @ObservedObject var session: EditorSession
    var embedded = false

    var body: some View {
        VStack(spacing: 0) {
            if !embedded {
                EditorHeader(session: session)
                Divider().overlay(Color.white.opacity(0.08))
            }
            HSplitView {
                WorkbenchPanel(session: session)
                    .frame(minWidth: 330, idealWidth: 430, maxWidth: 720)
                VSplitView {
                    PlayerPanel(session: session)
                        .frame(minHeight: 360, idealHeight: 600)
                    TimelinePanel(session: session)
                        .frame(minHeight: 230, idealHeight: 330)
                }
            }
        }
        .background(Color.editorBackground)
        .alert(
            "Yapper needs attention",
            isPresented: Binding(
                get: { session.errorMessage != nil },
                set: { if !$0 { session.dismissError() } }
            )
        ) {
            Button("OK", role: .cancel) { session.dismissError() }
        } message: {
            Text(session.errorMessage ?? "Unknown error")
        }
    }
}

private struct EditorHeader: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.yapperOrange)
                Image(systemName: "waveform.path.ecg")
                    .font(.system(size: 15, weight: .black))
                    .foregroundStyle(.black)
            }
            .frame(width: 30, height: 30)

            VStack(alignment: .leading, spacing: 1) {
                Text("Yapper Studio")
                    .font(.system(size: 13, weight: .bold))
                Text(session.project.name)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            if session.isBusy || session.isExporting {
                ProgressView()
                    .controlSize(.small)
            }
            Text(session.statusMessage)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)

            Button {
                ImportPanels.openMedia(for: session)
            } label: {
                Label("Import", systemImage: "plus")
            }
            .buttonStyle(EditorSecondaryButtonStyle())

            Button {
                ImportPanels.saveExport(for: session)
            } label: {
                Label("Export", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(EditorPrimaryButtonStyle())
            .disabled(session.project.clips.isEmpty || session.isExporting)
        }
        .padding(.horizontal, 16)
        .frame(height: 52)
        .background(Color.panelBackground)
    }
}

extension Color {
    static let editorBackground = Color(red: 0.035, green: 0.037, blue: 0.041)
    static let panelBackground = Color(red: 0.055, green: 0.058, blue: 0.064)
    static let raisedBackground = Color(red: 0.075, green: 0.078, blue: 0.086)
    static let yapperOrange = Color(red: 1, green: 0.48, blue: 0.13)
}

struct EditorPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(.black)
            .padding(.horizontal, 14)
            .frame(height: 32)
            .background(
                Color.yapperOrange.opacity(
                    isEnabled ? (configuration.isPressed ? 0.78 : 1) : 0.38
                )
            )
            .opacity(isEnabled ? 1 : 0.72)
            .clipShape(RoundedRectangle(cornerRadius: 7))
    }
}

struct EditorSecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.primary)
            .padding(.horizontal, 12)
            .frame(height: 32)
            .background(Color.white.opacity(configuration.isPressed ? 0.1 : 0.055))
            .overlay(
                RoundedRectangle(cornerRadius: 7)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .opacity(isEnabled ? 1 : 0.42)
    }
}
