import SwiftUI

/// How much of one Essentials field the AI reads. Quiet while it fits; once
/// the text runs past the limit it says so, because the end is cut before any
/// prompt and the creator would otherwise never know.
struct BrainFieldFit: View {
    let text: String
    let limit: Int

    var body: some View {
        let used = BrainFieldFit.length(text)
        HStack(spacing: 6) {
            if used > limit {
                Image(systemName: "scissors").font(.system(size: 10, weight: .semibold))
                Text("The last \(used - limit) characters aren't read")
                Spacer(minLength: 8)
            } else {
                Spacer(minLength: 0)
            }
            Text("\(used) / \(limit)").monospacedDigit()
        }
        .font(.system(size: 11))
        .foregroundStyle(used > limit ? NativeChip.Tone.yellow.color : Color.secondary.opacity(used == 0 ? 0 : 1))
        .animation(.easeOut(duration: 0.15), value: used > limit)
    }

    /// Counted the way the compiler counts: whitespace runs collapse to one
    /// space and the ends are trimmed.
    static func length(_ text: String) -> Int {
        text.split(whereSeparator: \.isWhitespace).joined(separator: " ").count
    }
}

/// One line under the card's title: whether every field fits, or how many
/// are cut short.
struct BrainEssentialsFitNote: View {
    let project: BrainProject

    var body: some View {
        let over = BrainProjectField.allCases.filter { BrainFieldFit.length(project[$0]) > $0.readLimit }
        if !over.isEmpty {
            Text(over.count == 1
                 ? "\u{201C}\(over[0].label)\u{201D} is longer than the AI reads. Keep it to a sentence or two and move the detail to Knowledge."
                 : "\(over.count) fields are longer than the AI reads. Keep each to a sentence or two and move the detail to Knowledge.")
                .font(.system(size: 12))
                .foregroundStyle(NativeChip.Tone.yellow.color)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
