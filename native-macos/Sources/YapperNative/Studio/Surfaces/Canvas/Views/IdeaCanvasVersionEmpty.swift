import SwiftUI

/// A format this idea has no version of yet. Before anything is spent it says
/// what the new version will be written from; while it is being written the
/// page shimmers where the words will land.
struct IdeaCanvasVersionEmpty: View {
    let format: IdeaCanvasVersionFormat
    /// Versions that exist and can be written from, the lead first.
    let sources: [IdeaCanvasVersionFormat]
    let hasSource: Bool
    let writing: Bool
    let error: String?
    var maxWidth: CGFloat = 1440
    let onWrite: (IdeaCanvasVersionFormat) -> Void

    @State private var from: IdeaCanvasVersionFormat?

    private var chosen: IdeaCanvasVersionFormat? { from ?? sources.first }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if writing { placeholder } else { card }
        }
        .frame(maxWidth: 640, alignment: .leading)
        .padding(.top, 32)
        // The same edge as the tabs and every document column above it.
        .frame(maxWidth: maxWidth, alignment: .leading)
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var card: some View {
        let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
        return VStack(alignment: .leading, spacing: 18) {
            Text("No \(format.noun) yet").font(.system(size: 18, weight: .semibold))
            if sources.count > 1 {
                HStack(spacing: 10) {
                    Text("Write it from").font(.system(size: 13)).foregroundStyle(.secondary)
                    Picker("Write it from", selection: Binding(get: { chosen ?? .short }, set: { from = $0 })) {
                        ForEach(sources) { Text($0.label).tag($0) }
                    }
                    .labelsHidden()
                    .pickerStyle(.segmented)
                    .fixedSize()
                }
            } else if let chosen {
                Text("Written from the \(chosen.label.lowercased()) version.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 7) {
                reads("Uses its \(chosen?.openerLabel.lowercased() ?? "hook"), script and key points")
                if hasSource { reads("Goes back to the original source for detail the \(chosen?.noun ?? "short") had to cut") }
                reads("Same cost as drafting an idea, and nothing is charged if it fails")
            }
            Button {
                if let chosen { onWrite(chosen) }
            } label: {
                Label("Write the \(format.noun)", systemImage: "sparkles")
            }
            .buttonStyle(EditorPrimaryButtonStyle(size: .small))
            .disabled(chosen == nil)
            if let error {
                Text(error).font(.system(size: 12)).foregroundStyle(NativeChip.Tone.yellow.color)
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(shape.fill(Color.studioFaintFill.opacity(0.5)))
        .overlay(shape.strokeBorder(Color.studioLineStrong, style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
    }

    private func reads(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Circle().fill(Color.secondary.opacity(0.5)).frame(width: 4, height: 4).offset(y: -2)
            Text(text).font(.system(size: 13)).foregroundStyle(.secondary)
        }
    }

    /// Where the new version will appear, shimmering while it is written.
    private var placeholder: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles").font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.yapperOrange)
                Text("Writing the \(format.noun)… this takes about half a minute.")
                    .font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
                    .nativeShimmer()
            }
            RoundedRectangle(cornerRadius: 6).fill(Color.studioFaintFill).frame(width: 420, height: 26).nativeShimmer()
            ForEach(0..<7, id: \.self) { row in
                RoundedRectangle(cornerRadius: 4).fill(Color.studioFaintFill)
                    .frame(maxWidth: row % 3 == 2 ? 380 : .infinity)
                    .frame(height: 12)
                    .nativeShimmer()
            }
        }
        .accessibilityLabel("Writing the \(format.noun)")
    }
}
