import SwiftUI
import UniformTypeIdentifiers

extension View {
    /// Takes an image file from Finder or image bytes dragged out of a
    /// browser as the reference thumbnail.
    func posterReferenceDrop(isTargeted: Binding<Bool>, enabled: Bool, remix: PosterRemixModel) -> some View {
        onDrop(of: [.fileURL, .image], isTargeted: isTargeted) { providers in
            guard enabled, let provider = providers.first else { return false }
            if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                _ = provider.loadObject(ofClass: URL.self) { url, _ in
                    guard let url, url.isFileURL else { return }
                    Task { @MainActor in remix.acceptReference(at: url) }
                }
                return true
            }
            provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { data, _ in
                guard let data, let image = PosterImageData.image(from: data) else { return }
                Task { @MainActor in remix.acceptReference(image, name: "Dropped image") }
            }
            return true
        }
    }
}
