import SwiftUI

/// The poster frame on a project card, drawn once and cached in the package.
struct ProjectPosterView: View {
    let listing: ProjectListing
    @State private var image: CGImage?
    @State private var attempted = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(white: 0.17), Color(white: 0.05)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            if let image {
                Image(decorative: image, scale: 1)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .transition(.opacity)
            } else if attempted {
                VStack(spacing: 6) {
                    Image(systemName: listing.summary.mediaCount == 0 ? "film" : "externaldrive.badge.questionmark")
                        .font(.system(size: 20, weight: .medium))
                    Text(listing.summary.mediaCount == 0 ? "Empty" : "Media offline")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(.white.opacity(0.6))
            }
        }
        .task(id: listing.id) {
            image = await ProjectPosterLoader.shared.poster(for: listing)
            attempted = true
        }
    }
}
