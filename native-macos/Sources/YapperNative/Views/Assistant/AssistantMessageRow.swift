import SwiftUI

/// One turn of the conversation.
///
/// What you asked sits in a filled bubble on the right, the way a message you
/// sent does everywhere else. What Chirpy answered runs plain on the left under
/// his face, because a reply that lists six changes reads as a list and not as
/// a speech bubble.
struct AssistantMessageRow: View {
    let message: AssistantMessage

    var body: some View {
        switch message.author {
        case .you:
            yours
        case .chirpy:
            his
        }
    }

    private var yours: some View {
        HStack {
            Spacer(minLength: 40)
            Text(message.text)
                .font(.system(size: 12))
                .foregroundStyle(.primary)
                .multilineTextAlignment(.leading)
                .textSelection(.enabled)
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(Color.studioFaintFill)
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(Color.studioLine, lineWidth: 1)
                }
        }
    }

    private var his: some View {
        HStack(alignment: .top, spacing: 8) {
            ChirpyMascot(
                expression: message.tone == .trouble ? .oops : .happy,
                talking: false,
                size: 22
            )
            .frame(width: 24, height: 24)

            VStack(alignment: .leading, spacing: 5) {
                Text(message.text)
                    .font(.system(size: 12, weight: message.notes.isEmpty ? .regular : .semibold))
                    .foregroundStyle(message.tone == .trouble ? Color.yapperOrange : .primary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)

                ForEach(message.notes, id: \.self) { note in
                    Label(note, systemImage: "checkmark.circle")
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 24)
        }
    }
}
