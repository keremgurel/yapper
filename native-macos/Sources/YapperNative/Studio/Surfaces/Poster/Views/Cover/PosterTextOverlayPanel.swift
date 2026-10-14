import SwiftUI

/// An optional headline burned onto the cover. Off by default.
struct PosterTextOverlayPanel: View {
    let draft: PosterCoverDraft
    let onChange: (PosterCoverDraft) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle("Text on the thumbnail", isOn: binding(\.showHeadline))
                .toggleStyle(.switch)
                .tint(.yapperOrange)
                .font(.system(size: 13, weight: .medium))
                .clickableCursor()
            if draft.showHeadline {
                TextField("Short thumbnail hook", text: Binding(
                    get: { draft.headline },
                    set: { var next = draft; next.headline = String($0.prefix(100)); onChange(next) }
                ))
                .textFieldStyle(.native)
                HStack(spacing: 12) {
                    NativeSegmented(
                        options: PosterCoverDraft.TextStyle.allCases.map { .init(value: $0, label: $0.rawValue.capitalized) },
                        selection: binding(\.textStyle)
                    )
                    .accessibilityLabel("Style")
                    NativeSegmented(
                        options: PosterCoverDraft.Position.allCases.map { .init(value: $0, label: $0.rawValue.capitalized) },
                        selection: binding(\.position)
                    )
                    .accessibilityLabel("Position")
                }
                .font(.system(size: 12))
            }
        }
    }

    private func binding<Value>(_ path: WritableKeyPath<PosterCoverDraft, Value>) -> Binding<Value> {
        Binding(get: { draft[keyPath: path] }, set: { value in
            var next = draft
            next[keyPath: path] = value
            onChange(next)
        })
    }
}
