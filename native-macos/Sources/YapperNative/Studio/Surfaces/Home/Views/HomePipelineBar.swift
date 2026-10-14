import SwiftUI

/// Every idea by where it is, as one proportional bar: the shape of the
/// pipeline at a glance, in the shared status hues.
struct HomePipelineBar: View {
    let items: [IdeaItem]

    private var counts: [(status: IdeaStatus, count: Int)] {
        IdeaStatus.allCases
            .map { status in (status, items.filter { $0.pipelineStatus == status }.count) }
            .filter { $0.count > 0 }
    }

    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                GeometryReader { proxy in
                    let gaps = CGFloat(max(counts.count - 1, 0)) * 2
                    HStack(spacing: 2) {
                        ForEach(counts, id: \.status) { stage in
                            Rectangle()
                                .fill(stage.status.tone.color)
                                .frame(width: (proxy.size.width - gaps) * CGFloat(stage.count) / CGFloat(items.count))
                        }
                    }
                }
                .frame(height: 8)
                .background(Color.studioFaintFill)
                .clipShape(Capsule())

                HStack(spacing: 16) {
                    ForEach(counts, id: \.status) { stage in
                        HStack(spacing: 6) {
                            Circle().fill(stage.status.tone.color).frame(width: 8, height: 8)
                            Text("\(stage.count)")
                                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                .foregroundStyle(.primary)
                            Text(stage.status.label.lowercased())
                        }
                    }
                }
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
            }
            .padding(.bottom, 4)
        }
    }
}
