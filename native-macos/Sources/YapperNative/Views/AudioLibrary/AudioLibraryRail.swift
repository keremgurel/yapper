import SwiftUI

/// The library's shelves, down the left of the page.
///
/// Counts follow the search, so typing "click" turns the rail into a summary of
/// where the clicks are rather than a list of shelves that no longer match.
/// Empty shelves stay visible and dim: they are how the creator learns that
/// music and voice have a place here before they have imported any.
struct AudioLibraryRail: View {
    let entries: [AudioEntry]
    let search: String
    @Binding var section: AudioLibrarySection

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            ForEach(AudioLibrarySection.rail) { candidate in
                row(candidate)
            }
        }
        .frame(width: 186, alignment: .leading)
    }

    private func row(_ candidate: AudioLibrarySection) -> some View {
        let count = AudioLibraryFilter.count(entries, section: candidate, search: search)
        let isSelected = candidate == section
        return Button {
            section = candidate
        } label: {
            HStack(spacing: 8) {
                Image(systemName: candidate.icon)
                    .font(.system(size: 11, weight: .semibold))
                    .frame(width: 15)
                Text(candidate.title)
                    .font(candidate.isHeading ? .studioCaptionStrong : .studioBody)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text("\(count)")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            .foregroundStyle(
                isSelected
                    ? Color.yapperOrange
                    : count == 0 ? Color.secondary.opacity(0.55) : Color.primary
            )
            .padding(.leading, candidate.isIndented ? 20 : 8)
            .padding(.trailing, 8)
            .frame(height: 27)
            .background {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(isSelected ? Color.yapperOrange.opacity(0.12) : .clear)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
    }
}
