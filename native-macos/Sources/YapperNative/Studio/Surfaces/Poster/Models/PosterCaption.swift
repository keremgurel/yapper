import Foundation

/// One platform's caption, the shape `/api/publish/caption` returns.
struct PosterCaption: Codable, Equatable {
    var platform: String
    var title: String
    var body: String
    var hashtags: [String]

    static func blank(_ platform: PublishPlatform) -> PosterCaption {
        PosterCaption(platform: platform.rawValue, title: "", body: "", hashtags: [])
    }

    /// Body then hashtags on their own line, exactly as it is posted.
    var rendered: String {
        let tags = hashtags.map { "#\($0)" }.joined(separator: " ")
        return [body.trimmingCharacters(in: .whitespacesAndNewlines), tags]
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    var hasText: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            || !body.trimmingCharacters(in: .whitespaces).isEmpty
            || !hashtags.isEmpty
    }
}

struct PosterCaptionResponse: Codable, Equatable {
    let captions: [PosterCaption]
}

/// One video's captions, keyed by platform. Absent means not written yet.
typealias PosterCaptionSet = [PublishPlatform: PosterCaption]

enum PosterHashtags {
    /// A tag in the stored shape: no hash, letters, digits and underscores.
    static func normalize(_ raw: String) -> String {
        let trimmed = raw.drop { $0 == "#" }
        let kept = trimmed.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) || $0 == "_" }
        return String(String.UnicodeScalarView(kept).prefix(60))
    }

    static func add(_ raw: String, to tags: [String]) -> [String] {
        var next = tags
        for piece in raw.split(whereSeparator: { $0.isWhitespace || $0 == "," }) {
            let tag = normalize(String(piece))
            if !tag.isEmpty, !next.contains(tag) { next.append(tag) }
        }
        return next
    }
}

extension Dictionary where Key == PublishPlatform, Value == PosterCaption {
    func caption(for platform: PublishPlatform) -> PosterCaption {
        self[platform] ?? .blank(platform)
    }

    /// Generated captions land here; a title-only pass never replaces a
    /// caption edited while the request ran.
    func merging(generated: [PosterCaption], titleOnly: Bool, sourceCaption: String) -> PosterCaptionSet {
        var merged = self
        for caption in generated {
            guard let platform = PublishPlatform(rawValue: caption.platform) else { continue }
            if titleOnly {
                var existing = merged[platform] ?? PosterCaption(platform: caption.platform, title: "", body: sourceCaption, hashtags: [])
                existing.title = caption.title
                merged[platform] = existing
            } else {
                merged[platform] = caption
            }
        }
        return merged
    }
}
