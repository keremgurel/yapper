import CoreGraphics
import Foundation

/// The AI remix step: a prompt, the selected frame (unless unticked), and
/// an optional reference thumbnail. Two credits per generation.
@MainActor
final class PosterRemixModel: ObservableObject {
    @Published var prompt = PosterThumbnailPrompt.standard
    @Published var useFrame = true
    @Published private(set) var reference: CGImage?
    @Published private(set) var referenceName = ""
    @Published private(set) var referenceError: String?
    @Published private(set) var generating = false
    @Published private(set) var error: String?

    func chooseReference() {
        guard let url = PosterImageData.chooseImage(title: "Choose a reference thumbnail") else { return }
        switch PosterImageData.coverImage(at: url) {
        case let .success(image):
            reference = image
            referenceName = url.lastPathComponent
            referenceError = nil
        case let .failure(message):
            referenceError = message.text
        }
    }

    func pasteReference() {
        guard let image = PosterImageData.pastedImage() else {
            referenceError = "There is no image on the clipboard."
            return
        }
        reference = image
        referenceName = "Pasted image"
        referenceError = nil
    }

    func clearReference() {
        reference = nil
        referenceName = ""
    }

    func generate(frame: CGImage?) async -> CGImage? {
        guard !generating else { return nil }
        generating = true
        error = nil
        defer { generating = false }
        do {
            let result: PosterGeneratedThumbnail = try await PosterHTTP.post("api/publish/thumbnail", body: .compact([
                "prompt": prompt.trimmingCharacters(in: .whitespacesAndNewlines),
                "frame": useFrame ? frame.flatMap { PosterImageData.jpegDataURL($0) } : nil,
                "reference": reference.flatMap { PosterImageData.jpegDataURL($0) },
            ]))
            guard let image = PosterImageData.image(fromDataURL: result.image) else { throw PosterMessage("") }
            return image
        } catch let failure as PosterHTTPError {
            error = switch failure.code {
            case "insufficient_credits": "You are out of credits for this month."
            case "not_entitled": "AI thumbnails need an active membership."
            default: "The thumbnail could not be generated. Try again."
            }
            return nil
        } catch {
            self.error = "The thumbnail could not be generated. Try again."
            return nil
        }
    }
}
