import SwiftUI

/// The four kinds of media that count against the plan, one tile each.
struct StorageMediaSection: View {
    let media: StorageUsage.Media

    private let columns = [GridItem(.adaptive(minimum: 200), spacing: 12)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Video storage").font(.nativeSectionTitle)
                    Text("These bytes count against your plan.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Button {
                    StorageLinks.open(StorageLinks.history)
                } label: {
                    Label("Manage videos", systemImage: "trash")
                }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
            }
            LazyVGrid(columns: columns, spacing: 12) {
                StorageMediaTile(
                    symbol: "film", label: "Uploaded videos",
                    detail: StorageFormat.count(media.recording.count, "saved master", "saved masters"),
                    bytes: media.recording.bytes
                )
                StorageMediaTile(
                    symbol: "externaldrive", label: "Cross-post imports",
                    detail: StorageFormat.count(media.import.count, "reusable platform copy", "reusable platform copies"),
                    bytes: media.import.bytes
                )
                StorageMediaTile(
                    symbol: "photo.on.rectangle", label: "Thumbnail assets",
                    detail: StorageFormat.count(media.thumbnail.count, "retained thumbnail", "retained thumbnails"),
                    bytes: media.thumbnail.bytes
                )
                StorageMediaTile(
                    symbol: "paintpalette", label: "Brand logos",
                    detail: StorageFormat.count(media.brandLogo.count, "saved logo", "saved logos"),
                    bytes: media.brandLogo.bytes
                )
            }
        }
    }
}

private struct StorageMediaTile: View {
    let symbol: String
    let label: String
    let detail: String
    let bytes: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                Image(systemName: symbol)
                    .font(.system(size: 14))
                    .foregroundStyle(.primary)
                    .frame(width: 34, height: 34)
                    .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Color.studioInputBackground))
                Spacer(minLength: 8)
                Text(StorageFormat.bytes(bytes))
                    .font(.system(size: 17, weight: .semibold).monospacedDigit())
            }
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .padding(.top, 14)
            Text(detail)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .nativeCard(padding: 16)
    }
}
