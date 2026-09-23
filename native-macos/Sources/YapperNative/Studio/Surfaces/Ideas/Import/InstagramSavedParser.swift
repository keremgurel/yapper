import Foundation

/// One saved post found in an Instagram export.
struct InstagramSavedEntry: Equatable {
    let url: String
    var title: String?
    var collection: String
    var savedAt: Double?
}

/// Reads saved posts out of the JSON and HTML documents in an Instagram
/// export. Ported from the web's `instagram-saved-import`: it does not trust
/// one filename or wrapper shape, because Meta changes both without notice.
enum InstagramSavedParser {
    static let allSaved = "All saved posts"

    static func parse(files: [String: String]) -> [InstagramSavedEntry] {
        var found: [InstagramSavedEntry] = []
        for (name, text) in files.sorted(by: { $0.key < $1.key }) {
            let lower = name.lowercased()
            if lower.hasSuffix(".json") {
                guard let data = text.data(using: .utf8), let value = try? JSONSerialization.jsonObject(with: data) else { continue }
                found += parseJSON(filename: name, value: value)
            } else if lower.hasSuffix(".html") || lower.hasSuffix(".htm") {
                found += parseHTML(filename: name, html: text)
            }
        }

        var unique: [String: InstagramSavedEntry] = [:]
        for entry in found {
            let key = InspoURL.normalize(entry.url)
            guard let current = unique[key] else { unique[key] = entry; continue }
            // A named collection beats the generic bucket; keep the newest date.
            if current.collection == allSaved && entry.collection != allSaved {
                unique[key] = entry
            } else if (entry.savedAt ?? 0) > (current.savedAt ?? 0) {
                unique[key]?.savedAt = entry.savedAt
            }
        }
        return unique.values.sorted { ($0.savedAt ?? 0) > ($1.savedAt ?? 0) }
    }

    /// A canonical post URL, or nil for anything that is not an Instagram
    /// post, Reel or video.
    static func postURL(_ value: Any?) -> String? {
        guard let raw = value as? String,
              let url = URL(string: raw.replacingOccurrences(of: "&amp;", with: "&")),
              let host = url.host?.lowercased(), host == "instagram.com" || host == "www.instagram.com"
        else { return nil }
        let path = url.path
        let lowered = path.lowercased()
        guard ["/p/", "/reel/", "/reels/", "/tv/"].contains(where: lowered.hasPrefix) else { return nil }
        var trimmed = path
        while trimmed.hasSuffix("/") { trimmed.removeLast() }
        return "\(url.scheme ?? "https")://www.instagram.com\(trimmed)/"
    }

    private static func humanize(_ value: String) -> String {
        var base = value
        if let dot = base.lastIndex(of: "."), dot != base.startIndex { base = String(base[..<dot]) }
        let spaced = base.replacingOccurrences(of: "[_-]+", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .ideasTrimmed
        return spaced.split(separator: " ").map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ")
    }

    private static func fileCollection(_ filename: String) -> String {
        let base = filename.split(separator: "/").last.map(String.init) ?? filename
        if base.range(of: "saved[_ -]?posts?", options: [.regularExpression, .caseInsensitive]) != nil { return allSaved }
        let human = humanize(base)
        return human.isEmpty ? "Instagram saves" : human
    }

    private static func timestamp(_ value: Any?) -> Double? {
        guard let number = value as? NSNumber, !(value is Bool) else { return nil }
        let seconds = number.doubleValue
        guard seconds.isFinite else { return nil }
        // Meta stores epoch seconds; the server takes milliseconds.
        return seconds < 10_000_000_000 ? seconds * 1000 : seconds
    }

    private static func label(_ record: [String: Any]) -> String? {
        for key in ["title", "name", "value"] {
            if let value = record[key] as? String, postURL(value) == nil {
                let trimmed = value.ideasTrimmed
                if !trimmed.isEmpty && trimmed.count <= 300 { return trimmed }
            }
        }
        return nil
    }

    private static func parseJSON(filename: String, value: Any) -> [InstagramSavedEntry] {
        var entries: [InstagramSavedEntry] = []
        let fallback = fileCollection(filename)

        func walk(_ node: Any, _ collection: String, _ path: [String]) {
            if let array = node as? [Any] {
                array.forEach { walk($0, collection, path) }
                return
            }
            guard let record = node as? [String: Any] else { return }
            let inCollection = path.contains { $0.range(of: "collection", options: .caseInsensitive) != nil }
            let possible = label(record)
            let next = inCollection && possible != nil && collection == fallback ? possible! : collection

            if let list = record["string_list_data"] as? [Any] {
                for raw in list {
                    guard let item = raw as? [String: Any],
                          let url = postURL(item["href"] ?? item["url"] ?? item["value"]) else { continue }
                    entries.append(InstagramSavedEntry(url: url, title: possible, collection: next, savedAt: timestamp(item["timestamp"] ?? record["timestamp"])))
                }
            }
            for key in record.keys.sorted() where key != "string_list_data" {
                let child = record[key]!
                if child is String {
                    if let url = postURL(child) {
                        entries.append(InstagramSavedEntry(url: url, title: possible, collection: next, savedAt: timestamp(record["timestamp"])))
                    }
                } else {
                    walk(child, next, path + [key])
                }
            }
        }

        walk(value, fallback, [])
        return entries
    }

    private static func parseHTML(filename: String, html: String) -> [InstagramSavedEntry] {
        let collection = fileCollection(filename)
        guard let pattern = try? NSRegularExpression(pattern: "href=[\"']([^\"']+)[\"']", options: .caseInsensitive) else { return [] }
        let ns = html as NSString
        return pattern.matches(in: html, range: NSRange(location: 0, length: ns.length)).compactMap { match in
            postURL(ns.substring(with: match.range(at: 1))).map {
                InstagramSavedEntry(url: $0, title: nil, collection: collection, savedAt: nil)
            }
        }
    }
}
