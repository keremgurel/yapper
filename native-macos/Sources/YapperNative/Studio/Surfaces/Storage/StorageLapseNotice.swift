import SwiftUI

/// Shown only to a lapsed account that still has videos stored: when they
/// will be deleted, and the one way to keep them.
struct StorageLapseNotice: View {
    let deleteOn: Date

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: "clock")
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text("Your stored videos will be deleted on \(deleteOn.formatted(date: .long, time: .omitted)).")
                    .font(.system(size: 13, weight: .semibold))
                Text("Your subscription ended. Resubscribe before then to keep them. Your Brain, ideas and scripts stay either way.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 12)
            Button("See plans") { StorageLinks.open(StorageLinks.pricing) }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        }
        .nativeCard(padding: 16)
    }
}
