import Foundation

/// The brand routes' error codes in the creator's words. Same wording as
/// the web brand panel.
enum BrandErrorMessage {
    static func text(for error: Error) -> String {
        guard let api = error as? StudioAPIError else {
            if let local = error as? BrandLogoUploadError { return local.message }
            return fallback
        }
        switch api.code {
        case "not_entitled": return "Brand assets are available on a Studio plan."
        case "storage_full": return "Your storage is full. Remove media before adding a logo."
        case "logo_limit": return "A brand kit can hold up to \(BrandLimits.maxLogos) logos."
        case "media_too_large": return "Logos must be smaller than 5 MB."
        case "bad_request": return "Use a PNG, JPG, WebP, or SVG logo."
        default: return api.isSignedOut || api.status == 429 ? api.message : fallback
        }
    }

    static let fallback = "That change could not be saved. Try again."
}
