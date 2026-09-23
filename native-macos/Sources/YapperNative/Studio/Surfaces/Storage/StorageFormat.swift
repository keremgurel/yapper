import Foundation

/// The web's `formatStorageBytes` and percent label, so both apps print the
/// same numbers for the same account.
enum StorageFormat {
    static func bytes(_ value: Double) -> String {
        let safe = value.isFinite && value > 0 ? value : 0
        guard safe > 0 else { return "0 B" }
        let units = ["B", "KB", "MB", "GB", "TB"]
        let unit = min(units.count - 1, Int(floor(log(safe) / log(1024))))
        let scaled = safe / pow(1024, Double(unit))
        let digits = scaled >= 100 || unit == 0 ? 0 : scaled >= 10 ? 1 : 2
        return String(format: "%.\(digits)f %@", scaled, units[unit])
    }

    static func percent(_ value: Double) -> String {
        String(format: value < 1 ? "%.2f%%" : "%.1f%%", value)
    }

    /// "1 saved master", "3 saved masters".
    static func count(_ count: Int, _ singular: String, _ plural: String) -> String {
        "\(count) \(count == 1 ? singular : plural)"
    }
}
