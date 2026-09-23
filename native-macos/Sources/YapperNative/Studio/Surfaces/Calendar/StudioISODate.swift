import Foundation

/// The API's timestamps: JavaScript `toISOString()` output, with or without
/// milliseconds. Reads both, writes the millisecond form the web sends.
enum StudioISODate {
    private static let withFraction = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
    private static let plain = Date.ISO8601FormatStyle()

    static func parse(_ string: String?) -> Date? {
        guard let string, !string.isEmpty else { return nil }
        return (try? withFraction.parse(string)) ?? (try? plain.parse(string))
    }

    static func string(_ date: Date) -> String {
        withFraction.format(date)
    }
}
