import SwiftUI

/// The looks a project can be graded with, and how much of one to use.
///
/// Every swatch is the filter's own maths run over the same gradient, so what a
/// tile shows is what the footage will do.
struct FiltersWorkbench: View {
    @ObservedObject var session: EditorSession

    private var filter: VisualFilter { session.project.resolvedVisualFilter }

    private let columns = [
        GridItem(.flexible(), spacing: 9),
        GridItem(.flexible(), spacing: 9),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Video filters")
                        .font(.studioSectionTitle)
                    Text("Applied to the preview and the final export")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                }

                LazyVGrid(columns: columns, spacing: 9) {
                    ForEach(VisualFilterID.allCases) { id in
                        FilterTile(
                            id: id,
                            strength: filter.strength,
                            selected: filter.id == id
                        ) {
                            session.setVisualFilter(VisualFilter(id: id, strength: filter.strength))
                        }
                    }
                }

                if filter.id != .original {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("STRENGTH")
                                .font(.studioCaptionStrong)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text("\(Int((filter.strength * 100).rounded()))%")
                                .font(.studioCaption)
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        InspectorSlider(
                            value: filter.strength * 100,
                            range: 0 ... 100,
                            decimals: 0
                        ) { percent in
                            session.setVisualFilter(
                                VisualFilter(id: filter.id, strength: percent / 100)
                            )
                        }
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: 520, alignment: .leading)
        }
        .inspectorPane(maxWidth: 520)
    }
}

/// One filter, shown as what it does to a picture rather than as a name.
private struct FilterTile: View {
    let id: VisualFilterID
    let strength: Double
    let selected: Bool
    let action: () -> Void

    /// The colours the swatch is built from, before grading.
    private static let swatch: [(r: Double, g: Double, b: Double)] = [
        (0.96, 0.72, 0.45),
        (0.85, 0.44, 0.36),
        (0.31, 0.45, 0.55),
        (0.13, 0.2, 0.27),
    ]

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 6) {
                LinearGradient(
                    colors: gradedSwatch,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .frame(height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                .overlay(alignment: .topTrailing) {
                    if selected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.white, Color.yapperOrange)
                            .padding(6)
                    }
                }

                Text(id.title)
                    .font(.studioBodyStrong)
                Text(id.hint)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? Color.studioSelectedFill : Color.raisedBackground)
            .overlay {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(
                        selected ? Color.yapperOrange.opacity(0.85) : Color.studioLine,
                        lineWidth: 1
                    )
            }
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .help(id.hint)
    }

    private var gradedSwatch: [Color] {
        let matrix = VisualFilter(id: id, strength: strength).colorMatrix
        return Self.swatch.map { color in
            let graded = matrix.apply(red: color.r, green: color.g, blue: color.b)
            return Color(red: graded.red, green: graded.green, blue: graded.blue)
        }
    }
}
