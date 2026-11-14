import SwiftUI

/// Search and the one-pillar filter above the list, with a count when
/// either narrows it.
struct IdeaFilterBar: View {
    @Binding var query: String
    @Binding var pillar: String?
    let pillarOptions: [String]
    let resultLabel: String?

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass").font(.studioLabel).foregroundStyle(.secondary)
                TextField("Search", text: $query).textFieldStyle(.plain).font(.studioBody)
                if !query.isEmpty {
                    Button { query = "" } label: { Image(systemName: "xmark").font(.studioCaption) }
                        .buttonStyle(.studioPlain)
                        .foregroundStyle(.secondary)
                        .help("Clear search")
                }
            }
            .padding(.horizontal, 10)
            .frame(width: 280, height: 32)
            .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.studioInputBackground))
            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))

            if !pillarOptions.isEmpty {
                Menu {
                    Button("All pillars") { pillar = nil }
                    Divider()
                    ForEach(pillarOptions, id: \.self) { name in
                        Button(name) { pillar = name }
                    }
                } label: {
                    Text(pillar ?? "All pillars").font(.studioLabelStrong)
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                .padding(.horizontal, 10)
                .frame(height: 32)
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
                .clickableCursor()
            }
            Spacer(minLength: 0)
            if let resultLabel {
                Text(resultLabel).font(.studioLabel.monospacedDigit()).foregroundStyle(.secondary)
            }
        }
        .padding(.bottom, 12)
    }
}
