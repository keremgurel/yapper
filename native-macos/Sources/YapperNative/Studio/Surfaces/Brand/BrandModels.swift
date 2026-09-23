import Foundation

/// One uploaded logo, from `GET /api/brand` or `POST /api/brand/logos`. The
/// url is presigned for viewing.
struct BrandLogo: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let mimeType: String
    let mediaBytes: Int
    var isPrimary: Bool
    let url: String

    var sizeLabel: String { "\(max(1, Int((Double(mediaBytes) / 1024).rounded()))) KB" }
}

/// The creator's brand kit. The first color is primary.
struct BrandKit: Codable, Equatable {
    var colors: [String]
    var logos: [BrandLogo]
}

struct BrandLogoEnvelope: Decodable, Equatable {
    let logo: BrandLogo
}

/// `POST /api/media/upload-url`: where to PUT the file, and its key.
struct BrandUploadTicket: Decodable, Equatable {
    let url: String
    let key: String
}

enum BrandLimits {
    static let maxColors = 8
    static let maxLogos = 8
    static let maxLogoBytes = 5 * 1024 * 1024
    static let starterColors = ["#FF7A21", "#151515", "#FFFFFF", "#FFD93D"]
    /// The order the web's "next color" suggestion walks through.
    static let suggestions = [
        "#FF7A21", "#151515", "#FFFFFF", "#FFD93D", "#3B9DFF",
        "#8B5CF6", "#10B981", "#EC4899", "#64748B",
    ]
}
